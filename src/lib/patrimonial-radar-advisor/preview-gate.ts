export function advisorPreviewEnabled(env:Readonly<Record<string,string|undefined>>) {
  return env.PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED==='true'&&env.PATRIMONIAL_RADAR_ADVISOR_PREVIEW_CONTEXT==='synthetic-local'&&['development','test'].includes(env.NODE_ENV??'')&&!env.VERCEL&&env.VERCEL_ENV!=='production';
}
