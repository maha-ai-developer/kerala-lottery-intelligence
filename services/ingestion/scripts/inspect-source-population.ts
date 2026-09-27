/**
 * Milestone 7A.5 - Source Population Discovery Script
 * Discovers and inspects all PDF files in data/source-documents/lottery-results
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PdfPageExtractorService,
  DocumentSemanticSegmentationService,
  LotteryEntityExtractorService,
  computeSha256
} from "@kerala-lottery/documents";

async function inspectAllPdfs() {
  const dir = join(process.cwd(), "data/source-documents/lottery-results");
  const files = readdirSync(dir).filter((f) => f.endsWith(".pdf")).sort();

  console.log(`Discovered ${files.length} total PDF files in ${dir}.`);

  const extractor = new PdfPageExtractorService();
  const segService = new DocumentSemanticSegmentationService();
  const entityService = new LotteryEntityExtractorService();

  const results: any[] = [];
  const shaMap = new Map<string, string>();
  const drawMap = new Map<string, string>();

  // Known 6 baseline files
  const canonical6Files = new Set([
    "271-2344-14-09-2026.pdf",
    "272-2349-15-09-2026.pdf",
    "273-2354-16-09-2026.pdf",
    "275-2358-17-09-2026.pdf",
    "276-2366-12-09-2026.pdf",
    "277-2340-13-09-2026.pdf"
  ]);

  for (let i = 0; i < files.length; i++) {
    const filename = files[i]!;
    const fullPath = join(dir, filename);
    const bytes = readFileSync(fullPath);
    const stats = statSync(fullPath);
    const sha = computeSha256(new Uint8Array(bytes));

    const dupSha = shaMap.get(sha);
    if (dupSha) {
      console.log(`[DUPLICATE SHA] ${filename} matches ${dupSha} (SHA: ${sha.slice(0, 12)}...)`);
    } else {
      shaMap.set(sha, filename);
    }

    try {
      const extRes = await extractor.extractPages(new Uint8Array(bytes), sha);
      const segmentation = segService.segmentDocument(extRes.pages);
      const extraction = entityService.extract(segmentation, extRes.pages);

      const lottery = extraction.drawMetadata?.lotteryName?.value || "UNKNOWN";
      const drawNum = extraction.drawMetadata?.drawNumber?.value || "UNKNOWN";
      const drawDate = extraction.drawMetadata?.drawDate?.value || "UNKNOWN";
      const totalResults = extraction.winningResults.length;
      const fullTicketCount = extraction.winningResults.filter((r) => !r.isSuffix).length;
      const suffixCount = extraction.winningResults.filter((r) => r.isSuffix).length;
      const drawKey = `${lottery}_${drawNum}_${drawDate}`;

      if (drawMap.has(drawKey)) {
        console.log(`[DUPLICATE DRAW KEY] ${filename} shares draw key with ${drawMap.get(drawKey)}: ${drawKey}`);
      } else {
        drawMap.set(drawKey, filename);
      }

      results.push({
        filename,
        size: stats.size,
        sha,
        lottery,
        drawNum,
        drawDate,
        totalResults,
        fullTicketCount,
        suffixCount,
        isCanonical6: canonical6Files.has(filename),
        valid: totalResults > 0
      });

      if ((i + 1) % 15 === 0 || i === files.length - 1) {
        console.log(`Processed ${i + 1}/${files.length} PDFs...`);
      }
    } catch (err: any) {
      console.error(`[ERROR PARSING] ${filename}:`, err?.message || err);
      results.push({
        filename,
        size: stats.size,
        sha,
        isCanonical6: canonical6Files.has(filename),
        error: err?.message || String(err),
        valid: false
      });
    }
  }

  const validRows = results.filter((r) => r.valid);
  const invalidRows = results.filter((r) => !r.valid);
  console.log(`\n============================================================`);
  console.log(`SOURCE POPULATION INSPECTION REPORT`);
  console.log(`============================================================`);
  console.log(`Total files discovered:     ${files.length}`);
  console.log(`Valid parsed documents:     ${validRows.length}`);
  console.log(`Invalid / Error documents:  ${invalidRows.length}`);
  console.log(`Unique SHA-256 counts:      ${shaMap.size}`);
  console.log(`Unique Draw Identifiers:    ${drawMap.size}`);
  console.log(`Canonical 6 baseline files: ${results.filter((r) => r.isCanonical6).length}`);

  const totalResults = validRows.reduce((acc, r) => acc + (r.totalResults || 0), 0);
  const totalFull = validRows.reduce((acc, r) => acc + (r.fullTicketCount || 0), 0);
  const totalSuffix = validRows.reduce((acc, r) => acc + (r.suffixCount || 0), 0);
  console.log(`Total WinningResults:       ${totalResults} (FULL_TICKET: ${totalFull}, SUFFIX: ${totalSuffix})`);

  // Date range
  const dates = validRows.map((r) => r.drawDate).filter(Boolean).sort();
  console.log(`Date range:                 ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`Sample draws:`);
  validRows.slice(0, 5).forEach((r) => {
    console.log(`  - ${r.filename}: ${r.lottery} (${r.drawNum}, ${r.drawDate}) -> ${r.totalResults} results`);
  });
  console.log(`  ... and ${validRows.length - 5} more draws.`);
  console.log(`============================================================\n`);
}

inspectAllPdfs().catch(console.error);
