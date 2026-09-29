import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetPath = path.join(root, 'public', 'annunci-10x', 'horyzon-loader-logo.png');
const componentPath = path.join(root, 'src', 'components', 'annunci-10x', 'annunci-10x-loader.tsx');
const cssPath = path.join(root, 'src', 'components', 'annunci-10x', 'annunci-10x.module.css');
const analyzePath = path.join(root, 'src', 'components', 'annunci-10x', 'annunci-10x-analyze-flow.tsx');
const clientPath = path.join(root, 'src', 'components', 'annunci-10x', 'annunci-10x-client.tsx');
const identityPath = path.join(root, 'src', 'components', 'annunci-10x', 'annunci-10x-identity-gate.tsx');
const fulfillmentPath = path.join(root, 'src', 'components', 'annunci-10x', 'annunci-10x-fulfillment-panel.tsx');

const {
  ANNUNCI10X_ANALYSIS_STAGE_PROGRESS,
  ANNUNCI10X_LOADER_LOGO_PATH,
  annunci10xProgressForAnalysisStage,
} = await import('../src/lib/annunci-10x/loading.ts');

await assertLoaderAsset();
await assertLoaderComponent();
await assertLoaderStyles();
await assertIntegrations();
assertStageMapping();

async function assertLoaderAsset() {
  assert.equal(ANNUNCI10X_LOADER_LOGO_PATH, '/annunci-10x/horyzon-loader-logo.png');

  const asset = await readFile(assetPath);
  const info = await stat(assetPath);
  assert.ok(info.size > 100_000, 'loader PNG must be a real non-empty asset');
  assert.deepEqual([...asset.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'loader asset must be a PNG');
  assert.equal(asset.readUInt32BE(16), 1188, 'loader PNG width must preserve the supplied asset');
  assert.equal(asset.readUInt32BE(20), 420, 'loader PNG height must preserve the supplied asset');
}

async function assertLoaderComponent() {
  const component = await readFile(componentPath, 'utf8');
  assert.match(component, /Annunci10xLoader/);
  assert.match(component, /role="progressbar"/);
  assert.match(component, /aria-valuemin=\{0\}/);
  assert.match(component, /aria-valuemax=\{100\}/);
  assert.match(component, /aria-valuenow=\{indeterminate \? undefined : rounded\}/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /cancelAnimationFrame/);
  assert.match(component, /prefers-reduced-motion: reduce/);
  assert.match(component, /delayMs = 180/);
  assert.doesNotMatch(component, /data:image\/png|base64|spinner/i);
}

async function assertLoaderStyles() {
  const css = await readFile(cssPath, 'utf8');
  assert.match(css, /--annunci10x-loader-navy: #132a31/);
  assert.match(css, /--annunci10x-loader-lime: #dae55b/);
  assert.match(css, /aspect-ratio: 1188 \/ 420/);
  assert.match(css, /object-fit: contain/);
  assert.match(css, /@keyframes annunci10xLoaderSweep/);
  assert.match(css, /@keyframes annunci10xLoaderDone/);
  assert.match(css, /prefers-reduced-motion: reduce/);
}

async function assertIntegrations() {
  const [analyze, client, identity, fulfillment] = await Promise.all([
    readFile(analyzePath, 'utf8'),
    readFile(clientPath, 'utf8'),
    readFile(identityPath, 'utf8'),
    readFile(fulfillmentPath, 'utf8'),
  ]);

  assert.match(analyze, /Annunci10xLoader/);
  assert.match(analyze, /annunci10xProgressForAnalysisStage/);
  assert.match(analyze, /busy === 'source'/);
  assert.match(analyze, /busy === 'result'/);
  assert.match(analyze, /Carichiamo l'offerta Annuncio 10x/);
  assert.doesNotMatch(analyze, /className=\{styles\.progressRail\}/);

  assert.match(identity, /Annunci10xLoader/);
  assert.match(identity, /busy === 'contact'/);
  assert.match(identity, /busy === 'request-code'/);
  assert.match(identity, /busy === 'verify-code'/);

  assert.match(client, /createLoader/);
  assert.match(client, /createStepLoaderLabels/);
  assert.match(client, /Carichiamo l'offerta Annuncio 10x/);
  assert.match(client, /Prepariamo il pagamento sicuro/);
  assert.match(client, /setCreateLoader\(null\)/);

  assert.match(fulfillment, /Verifichiamo il pagamento/);
  assert.match(fulfillment, /Riscriviamo il testo/);
  assert.match(fulfillment, /Prepariamo la generazione/);

  for (const source of [analyze, client, identity, fulfillment]) {
    assert.doesNotMatch(source, /data:image\/png|base64/i);
  }
}

function assertStageMapping() {
  const stageOrder = ['SOURCE_VALIDATION', 'PRECHECK', 'EXTRACT', 'PROFILE', 'STRATEGY', 'EVALUATE', 'CLARIFY', 'COMPLETE'];
  let previous = 0;
  for (const stage of stageOrder) {
    const progress = ANNUNCI10X_ANALYSIS_STAGE_PROGRESS[stage];
    assert.ok(progress >= previous, `${stage} must not regress`);
    previous = progress;
  }

  assert.equal(ANNUNCI10X_ANALYSIS_STAGE_PROGRESS.COMPLETE, 100);
  assert.deepEqual(annunci10xProgressForAnalysisStage({ stage: 'COMPLETE', status: 'READY' }), {
    progress: 100,
    label: 'Analisi completata',
    complete: true,
  });

  const regressed = annunci10xProgressForAnalysisStage({ stage: 'EXTRACT', status: 'RUNNING', previous: 70 });
  assert.equal(regressed.progress, 70, 'stage progress must not move backward when a previous floor exists');

  for (const stage of stageOrder) {
    const result = annunci10xProgressForAnalysisStage({ stage, status: stage === 'COMPLETE' ? 'READY' : 'RUNNING' });
    assert.doesNotMatch(result.label, /SOURCE_VALIDATION|PRECHECK|EXTRACT|PROFILE|STRATEGY|EVALUATE|CLARIFY|COMPLETE/);
  }
}
