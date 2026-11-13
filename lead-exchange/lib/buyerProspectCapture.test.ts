import { describe, expect, it, vi } from 'vitest';
import { captureBuyerProspectTouch, type CaptureBuyerProspectParams } from './buyerProspectCapture';

// A minimal fake Postgres client that understands just enough of the statements this module
// issues (the meta_lead_id dedup lookup, the active-prospect lookup, the insert/update branch,
// the touch insert, the audit insert) to exercise the real control flow, without a real
// database. Keyed off recognisable fragments of the SQL text, same convention as the fakeDb used
// in prospectUnsubscribe.test.ts.
function fakeDb(options: { existingMetaLeadProspectId?: number } = {}) {
  const prospects: Record<number, Record<string, unknown>> = {};
  const touches: Record<string, unknown>[] = [];
  const auditLog: Record<string, unknown>[] = [];
  let nextId = 1;

  const client = {
    query: vi.fn(async (text: string, values: unknown[] = []) => {
      if (text.includes('FROM buyer_prospect_touches t')) {
        if (options.existingMetaLeadProspectId) {
          return { rows: [{ prospect_id: options.existingMetaLeadProspectId, prospect_reference: `HLX-PROSPECT-${String(options.existingMetaLeadProspectId).padStart(6, '0')}` }] };
        }
        return { rows: [] };
      }
      if (text.includes('BEGIN') || text.includes('COMMIT') || text.includes('ROLLBACK')) {
        return { rows: [] };
      }
      if (text.includes('SELECT id, prospect_reference FROM buyer_prospects')) {
        const [normalisedEmail, industryId] = values as [string, number];
        const existing = Object.values(prospects).find(
          (p) => p.normalisedEmail === normalisedEmail && p.industry_id === industryId && p.converted_buyer_id == null
        );
        return existing ? { rows: [{ id: existing.id, prospect_reference: existing.prospect_reference }] } : { rows: [] };
      }
      if (text.startsWith('UPDATE buyer_prospects SET prospect_reference')) {
        const [reference, id] = values as [string, number];
        prospects[id].prospect_reference = reference;
        return { rows: [] };
      }
      if (text.startsWith('UPDATE buyer_prospects SET')) {
        // Repeat-touch update: last_touch_* / meta_* fields only, by design -- see the 17th
        // placeholder (id) and the SET list order in buyerProspectCapture.ts.
        const [source, channel, utmSource, , utmCampaign, fbclid, metaLeadId, , metaCampaignName, , , , , , , , id] = values as (string | number | null)[];
        const row = prospects[id as number];
        row.last_touch_channel = channel;
        row.last_touch_utm_source = utmSource;
        row.last_touch_utm_campaign = utmCampaign;
        row.last_touch_fbclid = fbclid;
        row.meta_lead_id = metaLeadId;
        row.meta_campaign_name = metaCampaignName;
        row.source = source;
        return { rows: [] };
      }
      if (text.startsWith('INSERT INTO buyer_prospects')) {
        const [, industryId, companyName, contactName, contactEmail, , , , , utmSource, utmMedium, utmCampaign, fbclid, channel] = values;
        const id = nextId++;
        const row = {
          id, contact_email: contactEmail, normalisedEmail: (contactEmail as string).trim().toLowerCase(), industry_id: industryId,
          company_name: companyName, contact_name: contactName, prospect_reference: `PENDING-${id}`, capture_channel: channel,
          utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign, fbclid, converted_buyer_id: null,
        };
        prospects[id] = row;
        return { rows: [{ id }] };
      }
      if (text.startsWith('INSERT INTO buyer_prospect_touches')) {
        touches.push({ prospectId: values[0], channel: values[1] });
        return { rows: [] };
      }
      if (text.startsWith('INSERT INTO audit_log')) {
        auditLog.push({ actor: values[0], action: values[1] });
        return { rows: [] };
      }
      throw new Error(`fakeDb: unrecognised query: ${text}`);
    }),
    release: vi.fn(),
  };

  return { db: { pool: { connect: vi.fn(async () => client) } }, prospects, touches, auditLog, client };
}

const base: CaptureBuyerProspectParams = {
  channel: 'website',
  industryId: 1,
  industrySlug: 'solar_battery',
  companyName: 'Acme Solar',
  contactName: 'Jo Bloggs',
  contactEmail: 'jo@acme.test',
  telephone: '07700900000',
  consentContact: true,
};

describe('captureBuyerProspectTouch', () => {
  it('a brand new prospect becomes both first-touch and last-touch, and gets one touch row', async () => {
    const { db, prospects, touches, auditLog } = fakeDb();
    const result = await captureBuyerProspectTouch(db, { ...base, utmSource: 'meta', utmCampaign: 'spring' });

    expect(result.isNewProspect).toBe(true);
    expect(result.isDuplicateMetaLead).toBe(false);
    expect(prospects[result.prospectId].utm_source).toBe('meta');
    expect(touches).toHaveLength(1);
    expect(auditLog[0].action).toBe('BUYER_PROSPECT_REGISTERED');
  });

  it('a repeat touch for the same email+industry does not create a second prospect', async () => {
    const { db, prospects, touches } = fakeDb();
    const first = await captureBuyerProspectTouch(db, { ...base, channel: 'website', utmSource: 'organic' });
    const second = await captureBuyerProspectTouch(db, { ...base, channel: 'meta_instant_form', utmSource: 'meta', utmCampaign: 'retarget' });

    expect(second.prospectId).toBe(first.prospectId);
    expect(Object.keys(prospects)).toHaveLength(1);
    expect(touches).toHaveLength(2);
  });

  it('first-touch channel and company name are never overwritten by a repeat touch', async () => {
    const { db, prospects } = fakeDb();
    const first = await captureBuyerProspectTouch(db, { ...base, channel: 'website', companyName: 'Original Name Ltd' });
    await captureBuyerProspectTouch(db, { ...base, channel: 'meta_instant_form', companyName: 'Sloppy Re-entry' });

    expect(prospects[first.prospectId].capture_channel).toBe('website');
    expect(prospects[first.prospectId].company_name).toBe('Original Name Ltd');
  });

  it('matches on email case-insensitively and ignoring surrounding whitespace', async () => {
    const { db, prospects } = fakeDb();
    const first = await captureBuyerProspectTouch(db, { ...base, contactEmail: '  Jo@Acme.test ' });
    const second = await captureBuyerProspectTouch(db, { ...base, contactEmail: 'jo@acme.test', channel: 'meta_instant_form' });

    expect(second.prospectId).toBe(first.prospectId);
    expect(Object.keys(prospects)).toHaveLength(1);
  });

  it('a meta_lead_id already recorded is a true no-op -- no new prospect, no new touch', async () => {
    const { db, prospects, touches } = fakeDb({ existingMetaLeadProspectId: 7 });
    const result = await captureBuyerProspectTouch(db, { ...base, channel: 'meta_instant_form', metaLeadId: 'lead_abc' });

    expect(result.isDuplicateMetaLead).toBe(true);
    expect(result.prospectId).toBe(7);
    expect(Object.keys(prospects)).toHaveLength(0);
    expect(touches).toHaveLength(0);
  });

  it('rolls back and rethrows if a write fails partway through', async () => {
    const { db, client } = fakeDb();
    const originalImpl = client.query.getMockImplementation()!;
    client.query.mockImplementation(async (text: string, values: unknown[] = []) => {
      if (text.startsWith('INSERT INTO buyer_prospects')) throw new Error('simulated failure');
      return originalImpl(text, values);
    });

    await expect(captureBuyerProspectTouch(db, base)).rejects.toThrow('simulated failure');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
