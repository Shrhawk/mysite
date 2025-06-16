export async function getMsForm(requestUrl, token) {
  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Config-Token': token,
    },
  });
  if (response.status === 200) {
    return response.json();
  }
  return { error: `Error loading webform: ${token}` };
}

export async function postMsForm(requestUrl, token, payload) {
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Config-Token': token,
      //token,
    },
    body: JSON.stringify(payload),
  });
  if (response.status === 200) {
    return response.json();
  }
  return { error: `Error loading webform: ${token}` };
}

function getEnv() {
  const prodDomains = ['www.eucrisa.com', 'pocfreucrisacom-main-live.web.pfizer'];
  const { hostname } = window.location;
  const isProdDomains = prodDomains.some((e) => hostname.includes(e));
  if (isProdDomains) return 'prod';
  if (hostname.includes('-staging')) return 'staging'
  return 'uat';
}

export function getFormApiEndpoint(placeholders, tokenKey) {
  const env = getEnv();
  let token = '';
  let msFormsRequestUrl = '';
  if (env === 'prod')
  {
    token = placeholders[tokenKey + 'TokenProd'];
    msFormsRequestUrl = placeholders.formApiEndpointProd;
  }
  else if (env === 'staging') {
    token = placeholders[tokenKey + 'TokenStaging'];
    msFormsRequestUrl = placeholders.formApiEndpointStaging;
  }
  else {
    token = placeholders[tokenKey + 'TokenUat'];
    msFormsRequestUrl = placeholders.formApiEndpointUat;
  }
  return { msFormsRequestUrl, token };
}