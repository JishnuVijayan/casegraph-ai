import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { EvidenceService } from '../evidence/service';
import { BriefService } from '../intake/brief';
import { Brief } from '../intake/types';
import { ReportImages, renderReportHtml } from './render';

@Injectable()
export class ExportsService {
  constructor(private readonly access: AccessStore, private readonly briefs: BriefService, private readonly evidence: EvidenceService) {}

  /** The submitted pictures, scaled to a readable size and embedded as data. Originals stay untouched on disk. */
  async images(req: ApiRequest, brief: Brief): Promise<ReportImages> {
    const out: ReportImages = new Map();
    for (const item of brief.evidence) {
      if (item.kind !== 'image') continue;
      try {
        const { bytes } = await this.evidence.readVerified(req, item.id);
        const { data, info } = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().flatten({ background: '#ffffff' })
          .resize({ width: 1100, height: 1900, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer({ resolveWithObject: true });
        out.set(item.id, { src: `data:image/jpeg;base64,${data.toString('base64')}`, width: info.width, height: info.height });
      } catch { /* a picture that cannot be shown is listed with a plain note instead */ }
    }
    return out;
  }

  /** Victim complaint report, generated fresh from the current case file each time. */
  async report(req: ApiRequest): Promise<{ html: string; filename: string }> {
    const caseId = req.caseRecord!.id;
    const brief = await this.briefs.build(caseId);
    const html = renderReportHtml(brief, await this.briefs.victim(caseId), new Date(), await this.images(req, brief));
    await this.access.audit(req.actor!, 'REPORT_DOWNLOADED', 'case', caseId, req.requestId);
    return { html, filename: `complaint-${brief.reference}.html` };
  }
}
