/**
 * Iubenda owns this static subtree: its blocker annotates the script elements.
 * Keep the blocker synchronous and ahead of page resources, as required by
 * https://www.iubenda.com/en/help/3834-cache-and-optimisation-of-the-iubenda-cookie-solution/
 * React must not reconcile the provider's annotations as application markup.
 */
const bootstrap = `
<script type="text/javascript">var _iub = _iub || []; (function(){
function publish(preference){var allowed=!!preference&&(preference.purposes?preference.purposes['5']===true:preference.consent===true);window.horyzonAdvertisingConsent=allowed;window.dispatchEvent(new CustomEvent('horyzon:advertising-consent',{detail:allowed}));}
_iub.csConfiguration={"siteId":4702460,"cookiePolicyId":64704330,"lang":"it",callback:{onPreferenceExpressed:publish,onConsentRejected:function(){publish(null);},onReady:function(){var api=_iub.cs&&_iub.cs.api;if(api&&api.isPreferenceExpressed&&api.isPreferenceExpressed())publish(api.getPreferences());}}};})();</script>
<script type="text/javascript" src="https://cs.iubenda.com/autoblocking/4702460.js"></script>
<script type="text/javascript" src="https://cdn.iubenda.com/cs/iubenda_cs.js" charset="UTF-8" async></script>
<script type="text/javascript" src="https://cdn.iubenda.com/iubenda.js" async></script>`;

export function CookieControls() {
  return <div id="horyzon-cookie-controls" style={{ display: 'contents' }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: bootstrap }} />;
}
