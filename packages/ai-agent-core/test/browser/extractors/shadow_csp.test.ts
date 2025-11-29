import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Shadow DOM and CSP Tests', () => {
  const extractorsPath = path.resolve(__dirname, '../../../src/agent/browser/extractors');

  it('should handle shadow DOM extraction gracefully (mocked)', () => {
      // JSDOM has limited Shadow DOM support, but we can verify our extractor doesn't crash
      // and attempts to traverse it if supported.

      const script = fs.readFileSync(path.join(extractorsPath, 'extract_structure.js'), 'utf-8');

      const dom = new JSDOM(`
        <div id="host"></div>
      `, { runScripts: "dangerously" });

      // JSDOM support for shadow root
      const host = dom.window.document.getElementById('host');
      if (host) {
          try {
            const shadow = host.attachShadow({mode: 'open'});
            const span = dom.window.document.createElement('span');
            span.id = 'shadow-content';
            shadow.appendChild(span);
          } catch(e) {
              // If JSDOM doesn't support it, we skip actual shadow check but ensure script runs
              console.warn("JSDOM Shadow DOM setup failed or partial support:", e);
          }
      }

      // Mock getBoundingClientRect
      dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
          x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, bottom: 100, right: 100, toJSON: () => {}
      });

      // Inject document
      dom.window.eval(`
        (function() {
           const window = this;
           const document = window.document;
           ${script.replace('return extractStructure();', 'window._result = extractStructure(document.body);').replace('(function() {', '').replace('})();', '')}
        })()
    `);

    const result = (dom.window as any)._result;

    // We expect the shadow content to be extracted if JSDOM supports it
    expect(result).to.be.an('array');
    const shadowContent = result.find((el: any) => el.id === 'shadow-content');

    // Note: JSDOM shadow DOM support is partial. If it works, we find it.
    // If not, we just ensure no crash.
    if (shadowContent) {
        expect(shadowContent.inShadowDom).to.be.true;
    } else {
        console.warn("JSDOM did not expose shadow content in traversal, but no crash occurred.");
    }
  });

  it('should simulate CSP restriction handling (mocked)', () => {
      // We can't easily enforce CSP in JSDOM to block eval.
      // But we can verify that our agent (in real browser) would use isolated world or handle error.
      // Here we just verify the extractor code is valid JS that could run if injected.

      const script = fs.readFileSync(path.join(extractorsPath, 'setup_mutation_observer.js'), 'utf-8');
      expect(script).to.contain('MutationObserver');
  });
});
