import {
  sampleRUM,
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForLCP,
  loadBlocks,
  loadBlock,
  loadCSS,
  getMetadata,
  toClassName,
  fetchPlaceholders,
} from './lib-franklin.js';
import { isNonProduction } from './utility-functions.js';

const LCP_BLOCKS = ['carousels']; // add your LCP blocks to the list
const PRODUCTION_DOMAINS = ["www.eucrisa.com/"];

/**
 * Turns absolute links within the domain into relative links.
 * @param {Element} main The container element
 */
export function makeLinksRelative(main) {
  // eslint-disable-next-line no-use-before-define
  const hosts = ['hlx.page', 'hlx.live', ...PRODUCTION_DOMAINS];
  main.querySelectorAll('a[href]').forEach((a) => {
    try {
      const url = new URL(a.href);
      const hostMatch = hosts.some((host) => url.hostname.includes(host));
      if (hostMatch) {
        a.href = `${url.pathname.replace('.html', '')}${url.search}${url.hash}`;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(`Could not make ${a.href} relative:`, error);
    }
  });
}

/**
 * Fetches metadata of page.
 * @param {string} path Pathname
 */
export async function fetchPageMeta(path) {
  const meta = {};
  const resp = await fetch(path);
  if (resp.ok) {
    // eslint-disable-next-line no-await-in-loop
    const text = await resp.text();
    const headStr = text.split('<head>')[1].split('</head>')[0];
    const head = document.createElement('head');
    head.innerHTML = headStr;
    const metaTags = head.querySelectorAll(':scope > meta');
    metaTags.forEach((tag) => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const value = tag.getAttribute('content');
      if (meta[name]) meta[name] += `, ${value}`;
      else meta[name] = value;
    });
  }
  return meta;
}

/** Validate Brighcove URL.
 * @param {string} link The suspected Brightcove URL.
*/
export function validateBrightcove(link) {
  const { hostname, pathname, searchParams } = new URL(link);
  if (hostname === 'players.brightcove.net' && searchParams) {
    const id = searchParams.get('videoId');
    if (id) {
      const [, account, type] = pathname.split('/');
      return account && type;
    }
  }
  return false;
}

/** Builds video block from a Brightcove anchor.
 * @param {Element} anchor The anchor containing the link to the Brightcove video.
 */
export function buildVideoBlock(a, ignoreExceptions = false) {
  const exceptionBlocks = ['video', 'hero'];
  const inExceptionBlock = !exceptionBlocks.every((b) => !a.closest(`.${b}`));
  if (!inExceptionBlock || ignoreExceptions) {
    const validLink = validateBrightcove(a.href);
    if (validLink) {
      const video = buildBlock('video', [[`<a href="${a.href}">${a.href}</a>`]]);
      if (a.parentElement && a.parentElement.nodeName === 'P') {
        a.parentElement.replaceWith(video);
      } else a.replaceWith(video);
    }
  }
}

/**
 * Builds hero block.
 * @param {Element} main The container element
 */

function buildHeroBlock(main) {
  if (main.querySelector('.hero')) return;
  const h1 = main.querySelector('.default-content-wrapper h1');
  const picture = main.querySelector('.default-content-wrapper picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const banner = [];
    const body = document.createElement('div');
    const section = h1.closest('main > div');
    if (!section.previousElementSibling) {
      [...section.children].forEach((child) => {
        if (child.querySelector('picture') && child.textContent.trim() === '') banner.push(child);
        else body.append(child);
      });
      section.append(buildBlock('hero', [banner, [body]]));
    } else {
      banner.push(picture);
      body.append(h1);
      const newSection = document.createElement('div');
      newSection.append(buildBlock('hero', [banner, [body]]));
      main.prepend(newSection);
    }
  }
}


function buildFragments(main) {
  main.querySelectorAll('a[href*=fragments]').forEach((a) => {
    try {
      const { origin, pathname } = new URL(a.href);
      if (origin === window.location.origin && pathname.includes('/fragments/')) {
        const fragment = buildBlock('fragment', [[`<a href="${a.href}">${a.href}</a>`]]);
        a.replaceWith(fragment);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(`Could not build fragment from ${a.href}:`, error);
    }
  });
}

function buildISI(main) {
  const isiMeta = getMetadata('isi');
  if (isiMeta !== 'off' && !main.classList.contains('sidekick-library')) {
    const isiPath = (isiMeta === 'on' || !isiMeta) ? '/global/isi' : new URL(isiMeta).pathname;
    const isi = buildBlock('isi', [[`<a href="${isiPath}">${window.location.origin}/global/isi</a>`]]);
    if (isiPath === '/global/isi') isi.classList.add('isi-default');
    const newSection = document.createElement('div');
    newSection.append(isi);
    main.append(newSection);
  }
}

function buildPreFooter(main) {
  const fragment = buildBlock('fragment', [
    ['<a href="/global/pre-footer">/global/pre-footer</a>'],
  ]);
  const newSection = document.createElement('div');
  newSection.append(fragment);
  main.append(newSection);
}

/**
 * Text to speech functionality.
 * @param {Element} main The main element
 */
async function wrapTTSAudio(main) {
  main.querySelectorAll('.icon.icon-audio').forEach((icon) => {
    let trigger = icon.closest('a');
    let file;
    if (!trigger) {
      const name = icon.previousSibling.textContent.toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z-]/g, '')
        .replace(/-{2,}/g, '-');
      file = `/assets/audio/${name}.mp3`;
      trigger = document.createElement('a');
      trigger.href = '#';
      icon.parentElement.replaceChild(trigger, icon);
      trigger.appendChild(icon);
    } else {
      file = trigger.href;
    }
    if (trigger.dataset.file || !file) return;

    trigger.dataset.file = file;
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const audio = new Audio(e.currentTarget.dataset.file);
      audio.play();
    });
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
async function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
    //buildFragments(main);
    //await wrapTTSAudio(main);
    const template = getMetadata('template');
    if (template !== 'unbranded') {
      buildISI(main);
      //buildPreFooter(main);
    }

    // decorate brightcove links
    main.querySelectorAll('a[href*=brightcove]').forEach((link) => {
      if (link.href === link.textContent) buildVideoBlock(link);
    });
    // decorate heading eyebrows
    main.querySelectorAll('p > strong').forEach((strong) => {
      const p = strong.closest('p');
      if (p.textContent.trim() === strong.textContent.trim()) {
        const next = p.nextElementSibling;
        if (next && next.nodeName.startsWith('H')) p.className = 'eyebrow';
      }
    });
    // decorate footnotes
    main.querySelectorAll('p > sub').forEach((sub) => {
      sub.closest('p').className = 'footnote';
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Builds and decorates modal from modal document.
 * @param {string} id The modal id
 * @param {string} path The path to the modal document
 * @param {string} destination The ultimate destination of an external link
 */
export async function buildModal(id, path, destination) {
  const resp = await fetch(`${path}.plain.html`);
  if (resp.ok) {
    const ph = await fetchPlaceholders();
    const modal = document.createElement('dialog');
    modal.innerHTML = await resp.text();
    modal.id = id;
    modal.className = 'modal';
    // eslint-disable-next-line no-use-before-define
    await decorateMain(modal, true);
    await loadBlocks(modal);

    // eslint-disable-next-line no-inner-declarations
    function removeModalOnkeyboard(event) {
      if (event.keyCode === 27) {
        event.preventDefault();
        document.body.style.overflowY = '';
        modal.close();
        modal.remove();
      }
    }

    modal.addEventListener('keydown', removeModalOnkeyboard);

    // build modal wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-wrapper';

    // decorate modal header
    const modalHeader = modal.firstElementChild;
    modalHeader.classList.add('modal-header');
    const title = modalHeader.querySelector('h1, h2, h3');
    if (title) {
      const labelId = toClassName(`modal-title-${title.textContent.trim()}`);
      title.id = labelId;
      modal.setAttribute('aria-labelledby', labelId);
    }

    // build close modal button
    const closeButton = document.createElement('button');
    closeButton.setAttribute('type', 'button');
    closeButton.className = 'modal-close';
    closeButton.setAttribute('aria-label', `${ph.modalClose}${title ? ` ${title.textContent.trim()}` : ''}`);
    // eslint-disable-next-line no-inner-declarations
    function closeModal() {
      document.body.style.overflowY = '';
      modal.close();
      modal.remove();
    }
    closeButton.addEventListener('click', closeModal);
    modalHeader.append(closeButton);

    // decorate modal footer
    const modalFooter = modal.lastElementChild;
    if (modalFooter.querySelector('.button-container')) {
      modalFooter.classList.add('modal-footer');
    }

    // decorate modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'section modal-body';
    const bodySections = [...modal.children].filter((section) => !section.className.includes('modal-'));
    bodySections.forEach((section) => {
      modalBody.classList.add(...section.classList);
      [...section.children].forEach((wrap) => modalBody.append(wrap));
    });
    modalHeader.after(modalBody);

    // build external modal ctas
    if (destination) {
      const primary = document.createElement('a');
      primary.className = 'button primary';
      primary.href = destination;
      primary.dataset.modal = false;
      primary.setAttribute('rel', 'noreferrer');
      primary.setAttribute('target', '_blank');
      primary.textContent = ph.externalPrimaryCta;
      const secondary = document.createElement('button');
      secondary.classList = 'button white-button';
      secondary.textContent = ph.externalSecondaryCta;
      secondary.setAttribute('type', 'button');
      secondary.addEventListener('click', closeModal);
      // wrap external modal ctas
      const wrap = document.createElement('p');
      wrap.className = 'button-container button-container-multi';
      wrap.append(primary, secondary);
      const container = document.createElement('div');
      container.append(wrap);
      modalFooter.append(container);
      modalFooter.className = 'section modal-footer';
    }

    // wrap modal content
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.append(modalHeader, modalBody);
    if (modalFooter.hasChildNodes()) content.append(modalFooter);
    wrapper.append(content);

    [...modal.children].forEach((el) => {
      if (el.textContent.trim() === '') el.remove();
    });
    modal.prepend(wrapper);

    // build backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    modal.append(backdrop);

    return modal;
  }
  return null;
}

function downloadCopay() {
  const downloadURL = localStorage.getItem('downloadURL');
  const downloadElem = document.querySelector('.columns.download .button-container a');
  if (downloadURL && downloadElem && downloadElem.innerHTML === 'Download card') {
    downloadElem.href = downloadURL;
    localStorage.removeItem('downloadURL');
  }
}

/**
 * Updates primary CTA of modal by id.
 * @param {string} id The modal id
 * @param {string} destination The ultimate destination of an external link
 */
function updateExternalModal(id, destination) {
  const modal = document.getElementById(id);
  if (modal) {
    const primary = modal.querySelector('.modal-footer .button.primary');
    if (primary) primary.href = destination;
  }
}

// Show modal at load for hashed URL
function showModalAtLoad(id, path) {
  buildModal(id, path).then((modal) => {
    document.body.append(modal);
    modal.show();
  });
}

// Check # in URL
async function checkHashedURL() {
  const hashedValue = window.location.hash.split('#')[1];
  if (hashedValue === 'terms-and-conditions') {
    showModalAtLoad('terms-and-condition', '/global/modals/copay-savings-card-terms-and-conditions');
  } else if (hashedValue === 'interim-care-terms-and-conditions') {
    showModalAtLoad('interim-care-terms-and-conditions', '/global/modals/interim-care-terms-and-conditions');
  } else if (hashedValue === 'watch-cibinqo') {
    const videoContainer = document.querySelectorAll('.video.block')[0];
    videoContainer.scrollIntoView(true);
  }
}

/**
 * Setup event listener on document.body for modals.
 */
async function setupModals() {
  const respAllow = await fetch('/global/popups/external-link-allowlist.json');
  if (!respAllow.ok) {
    return;
  }

  const externalLinkAllowList = await respAllow.text();
  const jsonLinkAllowList = JSON.parse(externalLinkAllowList);
  const allowListLink = jsonLinkAllowList.data.map((obj) => {
    const flatDomain = Object.values(obj).flat()[0];
    return flatDomain;
  });

  const origins = [
    window.location.origin,
    ...allowListLink.map((x) => x),
    ...PRODUCTION_DOMAINS.map((d) => `https://${d}`),
  ];

  const modalExceptions = ['pfizer', 'tel:'];

  document.body.addEventListener('click', async (e) => {
    const a = e.target.closest('a[href]');
    if (a) {
      const { href } = a;
      try {
        const { origin, pathname, hash } = new URL(href, window.location.href);
        if (hash !== '#no-modal' && a.dataset.modal !== 'false') {
          // anchor on page
          if (hash) {
            const target = document.getElementById(hash.replace('#', ''));
            if (target && origin === window.location.origin) {
              e.preventDefault();
              const scrollTo = target.tagName.startsWith('H') ? target : target.closest('.section');
              const top = scrollTo.getBoundingClientRect().top + window.scrollY;
              window.scrollTo({ top, behavior: 'smooth' });
            }
          }
          const external = !origins.includes(origin)
            && !modalExceptions.find((exception) => href.includes(exception));
          if (external || (window.location.origin === origin && pathname.includes('/modals/')) || (window.location.origin === origin && pathname.includes('/popups/'))) {
            // build modal
            e.preventDefault();
            const id = external ? 'modal-external-link' : toClassName(`modal-${pathname}`);
            if (!document.getElementById(id)) {
              const source = external ? '/global/popups/external-link' : href;
              const destination = external ? href : null;
              const modal = await buildModal(id, source, destination);
              document.body.append(modal);
            } else if (external) {
              updateExternalModal(id, href);
            }
            document.body.style.overflowY = 'hidden';
            let modelHeader = document.querySelector(".section.modal-header");
            if(modelHeader) {
              // Setting it from JS instead of CSS since it's not overriding from CSS
              modelHeader.style.overflowY = "auto";

              // Calling it in setTimeout to call it after popup gets loaded
              window.setTimeout(() =>
                // By default scroll position applying to bottom of the popup when applying overflowY. So, applying scrollTop: 0px
                modelHeader.scrollTop = "0px"
              , 0);
            }
            document.getElementById(id).show();
          }
          if (pathname.includes('.pdf') || (!external && (window.location.origin !== origin))) a.target = '_blank';
        } else if (hash === '#no-modal' || a.dataset.modal === 'false') {
          e.preventDefault();
          a.dataset.modal = false;
          window.open(href.replace('#no-modal', ''), '_blank');
          document.getElementById('modal-external-link').close();
          document.body.style.overflowY = '';
        }
        if (document.getElementById('modal-global-popups-external-link-hcp') && origin === 'https://www.cibinqohcp.com') {
          e.preventDefault();
          a.dataset.modal = false;
          window.open(href.replace('#no-modal', ''), '_blank');
          document.getElementById('modal-global-popups-external-link-hcp').close();
          document.body.style.overflowY = '';
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(`Could not open link ${a.href}:`, error);
      }
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export async function decorateMain(main, fragment = false) {
  decorateButtons(main);
  decorateIcons(main);
  if (!fragment) await buildAutoBlocks(main);
  decorateSections(main);
  // decorate heading only 'sections'
  main.querySelectorAll('.section').forEach((section) => {
    if (section.children.length === 1) {
      const wrapper = section.firstElementChild;
      if ([...wrapper.children].every((child) => child.tagName.startsWith('H') || child.className === 'eyebrow')) {
        section.classList.add('heading-only');
      }
    }
  });
  // decorate heading and footnote only content-wrappers
  main.querySelectorAll('.section .default-content-wrapper').forEach((wrapper) => {
    if ([...wrapper.children].every((child) => child.className === 'footnote')) {
      wrapper.classList.add('footnote-only');
      const previous = wrapper.previousElementSibling;
      if (previous) previous.classList.add('has-footnote');
    } else if ([...wrapper.children].every((child) => child.tagName.startsWith('H') || child.className === 'eyebrow')) {
      wrapper.classList.add('heading-only');
    }
  });
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  const main = doc.querySelector('main');
  if (main) {
    await decorateMain(main);
    document.body.classList.add('appear');
    await waitForLCP(LCP_BLOCKS);
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const url = window.location.href;

  // font loading
  if (window.innerWidth >= 900) loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (sessionStorage.getItem('fonts-loaded')) loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  } catch (error) {
    // do nothing
  }
  const main = doc.querySelector('main');
  await loadBlocks(main);

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);

  loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`, () => {
    try {
      if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
    } catch (error) {
      // do nothing
    }
  });

  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));

  const template = getMetadata('template');
  if (template !== 'unbranded') {
    loadHeader(document.querySelector('header'));
  }

  loadFooter(doc.querySelector('footer'));

  const isi = main.querySelector('.isi');
  if (isi) {
    await loadBlock(isi);
    const isiSection = isi.closest('.section');
    const firstSection = main.querySelector('.section');
    const observer = new IntersectionObserver((records) => {
      records.forEach((record) => {
        if (record.isIntersecting) {
          observer.disconnect();
          isiSection.dataset.sectionStatus = 'loaded';
          isiSection.style.visibility = null;
        }
      });
    });
    observer.observe(firstSection, {});
  }

  setupModals();
  downloadCopay();

  checkHashedURL();
  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  // Load reviews logic
  if (isNonProduction(window.location.hostname)) {
    try {
      await import(`${window.hlx.cmsBasePath}/tools/sidekick/sidekick.js`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Could not load reviews logic:', error);
    }
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  // handle 404 from document
  if (window.errorCode === '404') {
    const resp = await fetch('/global/404.plain.html');
    if (resp.status === 200) {
      const html = await resp.text();
      const main = document.querySelector('main');
      main.innerHTML = html;
      main.classList.remove('error');
    }
  }
  await loadEager(document);
  loadLazy(document);
  loadDelayed();
}

loadPage();
