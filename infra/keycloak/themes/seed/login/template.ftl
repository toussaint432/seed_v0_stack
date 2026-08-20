<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false><!DOCTYPE html>
<html lang="${(locale.currentLanguageTag)!"fr"}">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="robots" content="noindex, nofollow"/>
  <title>Sen Jiwu<#if realm.displayName??> — ${realm.displayName}</#if></title>
  <link rel="stylesheet" href="${url.resourcesPath}/css/login.css"/>
  <#if properties.scripts?has_content>
    <#list properties.scripts?split(' ') as script>
      <script src="${url.resourcesCommonPath}/${script}" type="text/javascript"></script>
    </#list>
  </#if>
</head>
<body>

<div class="seed-layout">

  <!-- ══ Panneau marque (gauche) ══════════════════════════════════════════ -->
  <div class="seed-brand">

    <!-- Éléments décoratifs SVG de fond -->
    <svg class="seed-deco-circles" viewBox="0 0 500 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="420" cy="80"  r="180" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      <circle cx="420" cy="80"  r="130" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      <circle cx="420" cy="80"  r="80"  fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <circle cx="60"  cy="520" r="140" fill="none" stroke="rgba(232,176,75,0.08)"  stroke-width="1"/>
      <circle cx="60"  cy="520" r="90"  fill="none" stroke="rgba(232,176,75,0.06)"  stroke-width="1"/>
    </svg>

    <!-- Grain texture overlay -->
    <div class="seed-grain" aria-hidden="true"></div>

    <!-- Illustration botanique — coupe anatomique de graine -->
    <svg class="seed-botanical" viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="200" cy="260" rx="140" ry="220" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
      <ellipse cx="200" cy="270" rx="92" ry="148" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.2"/>
      <ellipse cx="200" cy="310" rx="44" ry="68" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
      <path d="M200 378 L200 468" stroke="rgba(255,255,255,0.09)" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M200 400 L176 426" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-linecap="round"/>
      <path d="M200 420 L224 446" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-linecap="round"/>
      <path d="M200 148 Q172 194 170 272" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <path d="M200 148 Q228 194 230 272" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <path d="M108 130 Q90 260 116 384" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      <path d="M292 130 Q310 260 284 384" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      <ellipse cx="200" cy="230" rx="18" ry="28" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>
      <g transform="translate(58,98) rotate(-30,40,65)">
        <ellipse cx="40" cy="65" rx="28" ry="46" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>
        <ellipse cx="40" cy="68" rx="18" ry="30" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.8"/>
      </g>
      <g transform="translate(296,392) rotate(20,25,40)">
        <ellipse cx="25" cy="40" rx="20" ry="32" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="0.8"/>
      </g>
    </svg>

    <div class="seed-brand-inner">

      <!-- Logo -->
      <a href="${properties.frontendUrl}" class="seed-logo">
        <div class="seed-logo-mark">
          <img src="${url.resourcesPath}/img/SENJIWU.png" alt="Sen Jiwu" class="seed-logo-img"/>
        </div>
        <div class="seed-logo-text">
          <strong>Sen Jiwu</strong>
          <small>Filière semencière nationale</small>
        </div>
      </a>

      <!-- Hero -->
      <div class="seed-hero">
        <div class="seed-hero-eyebrow">
          <span class="seed-eyebrow-dot"></span>
          Plateforme nationale semencière
        </div>
        <h2 class="seed-brand-title">Filière semencière<br><em>nationale</em></h2>
        <p class="seed-brand-desc">
          Système d'information intégré pour la traçabilité, la gestion
          et la certification des semences agricoles du Sénégal.
        </p>
      </div>

      <!-- Stats -->
      <div class="seed-brand-stats">
        <div class="seed-brand-stat">
          <span class="seed-brand-stat-n">5</span>
          <span class="seed-brand-stat-l">Acteurs</span>
        </div>
        <div class="seed-brand-stat">
          <span class="seed-brand-stat-n">7</span>
          <span class="seed-brand-stat-l">Générations</span>
        </div>
        <div class="seed-brand-stat">
          <span class="seed-brand-stat-n">100%</span>
          <span class="seed-brand-stat-l">Traçable</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="seed-brand-footer">
        <span>© ${.now?string("yyyy")} Sen Jiwu · République du Sénégal</span>
        <span class="seed-brand-footer-sep">·</span>
        <span>v2.0</span>
      </div>

    </div>
  </div>

  <!-- ══ Panneau formulaire (droite) ══════════════════════════════════════ -->
  <div class="seed-form-panel">

    <!-- Dot grid décoratif -->
    <div class="seed-dot-grid" aria-hidden="true"></div>

    <!-- Bouton retour accueil -->
    <a href="${properties.frontendUrl}" class="seed-home-btn" title="Retour à la page d'accueil">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Accueil
    </a>

    <!-- Sélecteur de langue FR / EN -->
    <#if locale?? && locale.supported?has_content && locale.supported?size gt 1>
    <div class="seed-lang-switcher">
      <#list locale.supported as sup>
      <a href="${sup.url}"
         class="seed-lang-btn<#if locale.currentLanguageTag == sup.languageTag> seed-lang-btn--active</#if>"
         title="${sup.label}">
        ${sup.languageTag?upper_case}
      </a>
      </#list>
    </div>
    </#if>

    <!-- Logo Sen Jiwu en haut du panneau droit -->
    <div class="seed-panel-logo">
      <div class="seed-panel-logo-mark">
        <img src="${url.resourcesPath}/img/SENJIWU.png" alt="Sen Jiwu"/>
      </div>
      <div class="seed-panel-logo-text">
        <strong>Sen Jiwu</strong>
        <span>Plateforme semencière nationale — ISRA</span>
      </div>
    </div>

    <div class="seed-form-wrap">

      <!-- Badge sécurité -->
      <div class="seed-security-badge">
        <span class="seed-security-dot"></span>
        <span>Connexion sécurisée · OAuth 2.0 / PKCE</span>
      </div>

      <!-- Carte principale -->
      <div class="seed-card">

        <!-- Barre d'accent top -->
        <div class="seed-card-accent"></div>

        <!-- En-tête -->
        <div class="seed-card-header">
          <div class="seed-card-logo-sm">
            <img src="${url.resourcesPath}/img/SENJIWU.png" alt="Sen Jiwu"/>
          </div>
          <div class="seed-card-greeting">Bienvenue sur Sen Jiwu</div>
          <h1 class="seed-card-title">
            <#nested "header">
          </h1>
        </div>

        <!-- Message flash -->
        <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
        <div class="seed-alert seed-alert--${message.type}" role="alert">
          <span class="seed-alert-icon">
            <#if message.type == 'success'>✓<#elseif message.type == 'error'>✕<#elseif message.type == 'warning'>!<#else>i</#if>
          </span>
          <span>${kcSanitize(message.summary)?no_esc}</span>
        </div>
        </#if>

        <!-- Formulaire -->
        <div class="seed-card-form">
          <#nested "form">
        </div>

        <!-- Info complémentaire -->
        <#if displayInfo>
        <div class="seed-card-info">
          <#nested "info">
        </div>
        </#if>

      </div>

      <!-- Footer formulaire -->
      <div class="seed-form-footer">
        <span class="seed-form-footer-item">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L6.5 3.5H9L7 5.5L7.8 8L5 6.5L2.2 8L3 5.5L1 3.5H3.5L5 1Z" fill="currentColor"/></svg>
          Plateforme sécurisée
        </span>
        <span class="seed-form-footer-sep">·</span>
        <span class="seed-form-footer-item">Données chiffrées TLS 1.3</span>
        <span class="seed-form-footer-sep">·</span>
        <span class="seed-form-footer-item">Sen Jiwu · ISRA Sénégal</span>
      </div>

    </div>
  </div>

</div>

<#if scripts??>
  <#list scripts as script>
    <script src="${script}" type="text/javascript"></script>
  </#list>
</#if>

<script>
(function () {
  var pwd = document.getElementById('password');
  if (!pwd) return;

  var parent = pwd.parentElement;
  if (!parent) return;

  /* Évite la double injection si Keycloak a déjà un toggle */
  if (parent.querySelector('[data-pw-toggle]')) return;

  parent.style.position = 'relative';

  var SVG_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var SVG_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'seed-pw-toggle';
  btn.setAttribute('data-pw-toggle', '');
  btn.setAttribute('aria-label', 'Afficher le mot de passe');
  btn.innerHTML = SVG_EYE;
  parent.appendChild(btn);

  btn.addEventListener('click', function () {
    var visible = pwd.type === 'text';
    pwd.type = visible ? 'password' : 'text';
    btn.innerHTML = visible ? SVG_EYE : SVG_EYE_OFF;
    btn.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
    pwd.focus();
  });
})();
</script>

</body>
</html>
</#macro>
