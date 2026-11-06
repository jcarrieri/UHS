// Splash screen navigation: keep preview mode and existing account handlers intact.
const pageView = new URLSearchParams(window.location.search).get('view');
if (pageView === 'account') document.getElementById('account-layout').hidden = false;
else if (pageView === 'learn') document.getElementById('learn').hidden = false;
else document.getElementById('splash').hidden = false;
'use strict';
const $ = id => document.getElementById(id);
let mode = 'register';
function setMode(next) {
  mode = next;
  $('register-tab').classList.toggle('active',mode==='register');
  $('login-tab').classList.toggle('active',mode==='login');
  $('register-tab').setAttribute('aria-selected', String(mode==='register'));
  $('login-tab').setAttribute('aria-selected',String(mode==='login'));
  $('name-field').hidden = mode==='login';
  $('confirm-field').hidden = mode==='login';
  $('id-info').hidden = mode==='login';
  $('form-title').textContent = mode==='register' ? 'Create your account' : 'Welcome back';
  $('form-subtitle').textContent = mode==='register' ? 'Join the conversation. It only takes a moment.' : 'Log in to your UHS account.';
  $('submit').firstChild.textContent = mode==='register' ? 'Create my account ' : 'Log in ';
  $('password').setAttribute('autocomplete',mode==='register'?'new-password':'current-password');
  $('error').hidden = true;
}
function showAccount(member) {
  if (pageView !== 'account') return;
  $('auth').hidden=true; $('account').hidden=false;
  $('account-id').textContent=String(member.id);
  $('account-name').textContent=member.displayName;
  $('account-email').textContent=member.email;
}
function fail(text) { $('error').textContent=text; $('error').hidden=false; }
async function request(route, data) {
  const response = await fetch('/UHS/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  const result = await response.json();
  if(!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
$('register-tab').addEventListener('click',()=>setMode('register'));
$('login-tab').addEventListener('click',()=>setMode('login'));
$('form').addEventListener('submit',async event=>{
  event.preventDefault(); $('error').hidden=true;
  const displayName=$('name').value.trim(),email=$('email').value.trim(),password=$('password').value;
  if (mode==='register') {
    if(displayName.length < 2) return fail('Enter a display name of at least 2 characters.');
    if(password.length < 12) return fail('Choose a password of at least 12 characters.');
    if(password!==$('confirm').value) return fail('Passwords do not match.');
  }
  if(!$('email').validity.valid) return fail('Enter a valid email address.');
  $('submit').disabled=true;
  try { const result=await request(mode==='register'?'register':'login',{displayName,email,password}); showAccount(result.member); }
  catch(err){fail(err.message || 'Unable to connect to UHS.');}
  finally{$('submit').disabled=false;}
});
$('logout').addEventListener('click',async()=>{
  try { await request('logout',{}); } catch(e) { console.error(e); }
  $('account').hidden=true; $('auth').hidden=false; $('password').value=''; $('confirm').value=''; setMode('login');
});
fetch('/UHS/api/me').then(r=>r.json()).then(r=>{if(r.member) showAccount(r.member);}).catch(()=>{});

// Public Render previews never accept credentials. Keep the login UI visible as a design preview.
fetch('/UHS/api/status').then(r=>r.json()).then(({previewOnly})=>{
  if (!previewOnly) return;
  const notice=document.createElement('div'); notice.className='preview-notice'; notice.setAttribute('role','status');
  notice.textContent='Website preview only: registration and login are not yet active. Please do not enter passwords.';
  $('form').before(notice);
  for (const input of $('form').querySelectorAll('input')) input.disabled=true;
  $('submit').disabled=true;
  $('submit').textContent='Registration opens after database setup';
  $('register-tab').disabled=true; $('login-tab').disabled=true;
}).catch(()=>{});
