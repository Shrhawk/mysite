/**
 *
 * @param {HTMLElement} element
 */
export function addStylesToContent (element) {
    const first = element.firstChild;
    // Leave as is if it's an H1+ tag
    if (/(h|H)(1|2|3|4|5|6)/.test(element.tagName)) return;
    if (!first || first.nodeType === 3) element.classList.add('text');

    if(element.tagName.toLowerCase() === 'ul') {
        [...element.children].forEach((_child) => {
            _child.classList.add('subheader')
        })
    }

    if (first.tagName === 'STRONG') {
        first.classList.add('header')
    }
    if (first.tagName === 'EM') {
        first.classList.add('subheader');
    }
}

/**
 *
 * @param {string[]} variants
 * @param {HTMLElement} element
 */
export const addButtonnClasses = (variants, element) => {
    const btnClasses = variants.filter(variant => variant.startsWith('btn'));
    const btns = element.querySelectorAll('a');
    btns.forEach(btn => btn.classList.add(...btnClasses));
}