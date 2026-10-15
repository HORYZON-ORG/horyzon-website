import { open, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertLiveSmoke, assertSmokeReport, createSmokeRun, parseSmokeArgs, publicSmokeReport, runPatrimonialSmoke, SmokeError, smokeMarkdown } from './lib/patrimonial-live-smoke.mjs';
import { createSmokeRuntime } from './lib/patrimonial-live-smoke-runtime.mjs';

async function main() {
  const env = process.env, args = process.argv.slice(2), stamp = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${crypto.randomUUID()}`;
  let run = createSmokeRun(), jsonFile, markdownFile;
  const persist = async report => {
    for (const [file, content] of [[jsonFile, JSON.stringify(report, null, 2) + '\n'], [markdownFile, smokeMarkdown(report)]]) {
      await file.truncate(0); await file.write(content, 0, 'utf8'); await file.sync();
    }
  };
  try {
    // Exclusive handles touch only files created by this invocation; no directory
    // enumeration, wildcard deletion, existing report overwrite or tmp cleanup.
    const directory = path.resolve('tmp'); await mkdir(directory, { recursive: true });
    jsonFile = await open(path.join(directory, `patrimonial-live-smoke-${stamp}.json`), 'wx', 0o600);
    markdownFile = await open(path.join(directory, `patrimonial-live-smoke-${stamp}.md`), 'wx', 0o600);
    const options = parseSmokeArgs(args);
    if (options.report) {
      const source = path.resolve(options.report);
      if (!/^patrimonial-live-smoke-[A-Za-z0-9-]+\.json$/.test(path.basename(source)) || path.dirname(source) !== directory) throw new Error('Invalid report path');
      const sourceReport = JSON.parse(await readFile(source, 'utf8'));
      assertSmokeReport(sourceReport); run = sourceReport;
    }
    const result = await runPatrimonialSmoke({ options, env, run, persist, runtimeFactory: async ({ guard }) => {
      assertLiveSmoke(options, env);
      if (!options.bindings) throw new SmokeError('VERIFIED_BINDINGS_REQUIRED');
      const modulePath = path.resolve(options.bindings);
      // Reports under tmp are data, never executable binding modules.
      if (path.relative(directory, modulePath).split(path.sep)[0] !== '..' || !modulePath.endsWith('.mjs')) throw new Error('Invalid bindings module');
      const bindingModule = await import(pathToFileURL(modulePath).href);
      return createSmokeRuntime({ env, bindings: bindingModule.bindings, guard });
    } });
    console.log(`Patrimonial smoke: ${result.result}; report tmp/patrimonial-live-smoke-${stamp}.json`);
    if (result.result === 'FAIL') process.exitCode = 1;
  } catch {
    run.result = 'FAIL'; run.error = 'CLI_ABORTED';
    if (jsonFile && markdownFile) await persist(publicSmokeReport(run, env));
    console.error('Patrimonial smoke aborted; no credentials or provider body logged.'); process.exitCode = 1;
  } finally { await jsonFile?.close(); await markdownFile?.close(); }
}
// Importing helper code is safe; the CLI entry point is never invoked by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
