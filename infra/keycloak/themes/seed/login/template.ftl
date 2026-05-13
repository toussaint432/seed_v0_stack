<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false><!DOCTYPE html>
<html lang="${(locale.currentLanguageTag)!"fr"}">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="robots" content="noindex, nofollow"/>
  <title>SEED · ISRA<#if realm.displayName??> — ${realm.displayName}</#if></title>
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

    <div class="seed-brand-inner">

      <!-- Logo -->
      <a href="${(url.loginUrl)!"#"}" class="seed-logo">
        <div class="seed-logo-mark">
          <img src="${url.resourcesPath}/img/logo-isra.png" alt="ISRA" class="seed-logo-img"/>
        </div>
        <div class="seed-logo-text">
          <strong>SEED Platform</strong>
          <small>ISRA · CNRA</small>
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

      <!-- Pipeline -->
      <div class="seed-pipeline">
        <div class="seed-pipeline-label">
          <span class="seed-pipeline-label-line"></span>
          Traçabilité générationnelle
        </div>
        <div class="seed-pipeline-track">
          <div class="seed-gen-wrap">
            <span class="seed-gen seed-gen-g0">G0</span>
            <span class="seed-gen-sub">Pré-base</span>
          </div>
          <span class="seed-pipeline-arrow">→</span>
          <div class="seed-gen-wrap">
            <span class="seed-gen seed-gen-g1">G1</span>
            <span class="seed-gen-sub">Base</span>
          </div>
          <span class="seed-pipeline-arrow">→</span>
          <div class="seed-gen-wrap">
            <span class="seed-gen seed-gen-g2">G2</span>
            <span class="seed-gen-sub">R1</span>
          </div>
          <span class="seed-pipeline-arrow">→</span>
          <div class="seed-gen-wrap">
            <span class="seed-gen seed-gen-g3">G3</span>
            <span class="seed-gen-sub">R1</span>
          </div>
          <span class="seed-pipeline-arrow">→</span>
          <div class="seed-gen-wrap">
            <span class="seed-gen seed-gen-r1">R1</span>
            <span class="seed-gen-sub">Cert.</span>
          </div>
          <span class="seed-pipeline-arrow">→</span>
          <div class="seed-gen-wrap seed-gen-wrap--final">
            <span class="seed-gen seed-gen-r2">R2</span>
            <span class="seed-gen-sub">Commercial</span>
          </div>
        </div>
      </div>

      <!-- Features -->
      <ul class="seed-features">
        <li class="seed-feature-item">
          <span class="seed-feature-icon">◆</span>
          <span>Certification variétale multi-génération</span>
        </li>
        <li class="seed-feature-item">
          <span class="seed-feature-icon">◆</span>
          <span>Contrôle qualité et traçabilité des lots</span>
        </li>
        <li class="seed-feature-item">
          <span class="seed-feature-icon">◆</span>
          <span>Gestion des acteurs de la chaîne semencière</span>
        </li>
      </ul>

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
        <span>© ${.now?string("yyyy")} ISRA / CNRA · République du Sénégal</span>
        <span class="seed-brand-footer-sep">·</span>
        <span>v2.0</span>
      </div>

    </div>
  </div>

  <!-- ══ Panneau formulaire (droite) ══════════════════════════════════════ -->
  <div class="seed-form-panel">

    <!-- Dot grid décoratif -->
    <div class="seed-dot-grid" aria-hidden="true"></div>

    <!-- Logo ISRA en haut du panneau droit -->
    <div class="seed-panel-logo">
      <div class="seed-panel-logo-mark">
        <img src="${url.resourcesPath}/img/logo-isra.png" alt="ISRA"/>
      </div>
      <div class="seed-panel-logo-text">
        <strong>SEED Platform</strong>
        <span>Institut Sénégalais de Recherches Agricoles</span>
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
            <img src="${url.resourcesPath}/img/logo-isra.png" alt="ISRA"/>
          </div>
          <div class="seed-card-greeting">Bienvenue sur SEED</div>
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
        <span class="seed-form-footer-item">ISRA Sénégal</span>
      </div>

    </div>
  </div>

</div>

<#if scripts??>
  <#list scripts as script>
    <script src="${script}" type="text/javascript"></script>
  </#list>
</#if>

</body>
</html>
</#macro>
