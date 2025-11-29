import { AgentContext } from '../../core/context';
import fs from 'fs';
import path from 'path';

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface DomElementIntelligence {
  elementId: string; // stable identifier for serialization
  tagName: string;
  id?: string;
  className?: string;
  attributes: Record<string, string>;
  boundingRect: BoundingRect; // JSON-serializable replacement for DOMRect
  computedStyles: Record<string, string>;
  eventHandlers: EventHandler[];
  children: string[]; // child elementIds to avoid object cycles
  scrollInfo: ScrollInfo;
  animations: AnimationData[];
  relatedAssets: AssetReference[];
  path?: string; // CSS Selector path
}

export interface EventHandler {
  type: string;
  hasHandler: boolean; // avoid storing function source for security/size
  framework?: 'react' | 'vue' | 'angular' | 'jquery';
  isInline: boolean;
  source?: string;
}

export interface ScrollInfo {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
}

export interface AnimationData {
  name: string;
  duration: number;
  delay: number;
  timingFunction: string;
  properties?: string[];
  iterationCount?: string;
}

export interface AssetReference {
  type: 'image' | 'video' | 'audio' | 'icon' | 'stylesheet' | 'script';
  url: string;
  elementId?: string; // reference by id to avoid embedding full object
}

export interface MutationSummary {
  type: 'attributes' | 'childList' | 'characterData';
  targetId: string;
  attributeName?: string;
  addedNodes?: string[]; // elementIds
  removedNodes?: string[]; // elementIds
}

export interface DomIntelligenceCache {
  elements: Record<string, DomElementIntelligence>; // JSON-safe instead of Map
  timestamp: number;
  pageUrl: string;
  mutations: MutationSummary[]; // JSON-safe subset of MutationRecord
}

export class DomIntelligenceAgent {
  private context: AgentContext;
  private extractors: Map<string, string> = new Map();
  private cache: DomIntelligenceCache | null = null;
  private extractorsPath: string;

  constructor(context: AgentContext) {
    this.context = context;
    // Assuming standard path structure relative to this file
    this.extractorsPath = path.join(__dirname, 'extractors');
    this.loadExtractors();
  }

  private loadExtractors() {
    const extractorFiles = [
      'extract_structure.js',
      'extract_styles.js',
      'extract_events.js',
      'extract_assets.js',
      'comprehensive_element_extractor.js',
      'extract_related_files.js',
      'extract_animations.js',
      'setup_mutation_observer.js'
    ];

    for (const file of extractorFiles) {
      try {
        const content = fs.readFileSync(path.join(this.extractorsPath, file), 'utf-8');
        this.extractors.set(file, content);
      } catch (error) {
        console.error(`Failed to load extractor ${file}:`, error);
      }
    }
  }

  // Abstract method to be implemented by specific browser adapters (Node, Web, Extension, Electron)
  // or passed via context if possible.
  // Since AgentContext is generic, we might need a way to execute scripts.
  // However, BaseBrowserLabelsAgent usually has methods for this.
  // But DomIntelligenceAgent is a helper.
  // We need to know how to execute scripts.

  // Design doc says: injectExtractors(agentContext)
  // But how does it execute?
  // Maybe we pass the execution function or the browser page object.
  // Let's assume we pass an executor function or use what's available in context if extended.

  // For now, let's define the interface and let the caller provide the execution mechanism.

  async runExtractorsParallel(
    executor: (script: string) => Promise<any>,
    extractorNames: string[] = Array.from(this.extractors.keys())
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const promises = extractorNames.map(async (name) => {
      const script = this.extractors.get(name);
      if (!script) {
        console.warn(`Extractor ${name} not found`);
        return;
      }
      try {
        // Wrap in IIFE if not already? The files are IIFEs.
        const result = await executor(script);
        results[name] = result;
      } catch (error) {
        console.error(`Error executing extractor ${name}:`, error);
        results[name] = { error: String(error) };
      }
    });

    await Promise.all(promises);
    return results;
  }

  async getIntelligence(
      executor: (script: string) => Promise<any>,
      useCache: boolean = true
  ): Promise<DomIntelligenceCache> {
      if (useCache && this.cache && (Date.now() - this.cache.timestamp < 5000)) { // 5s TTL for demo
          return this.cache;
      }

      // Run all extractors in parallel
      const results = await this.runExtractorsParallel(executor);

      const comprehensive = results['comprehensive_element_extractor.js'];
      const structure = results['extract_structure.js'];
      const styles = results['extract_styles.js'];
      const events = results['extract_events.js'];
      const animations = results['extract_animations.js'];
      // Assets and related files are page-level, need handling

      if (!comprehensive || comprehensive.error) {
          throw new Error('Failed to get DOM intelligence');
      }

      // Parse and structure the data
      const elements: Record<string, DomElementIntelligence> = {};

      // We need to map the raw array to our structure
      // The comprehensive extractor returns an array of objects.
      if (Array.isArray(comprehensive)) {
          comprehensive.forEach((el: any, index: number) => {
              // Generate a stable ID if not present
              const elementId = el.id || `gen_id_${index}`;
              const path = el.path;

              // Find matching data from other extractors using path or id
              const structData = Array.isArray(structure) ? structure.find((s: any) => s.path === path) : null;
              const styleData = Array.isArray(styles) ? styles.find((s: any) => s.path === path) : null;
              const eventData = Array.isArray(events) ? events.find((e: any) => e.path === path) : null;
              const animData = Array.isArray(animations) ? animations.find((a: any) => a.path === path) : null;

              elements[elementId] = {
                  elementId: elementId,
                  tagName: el.tagName,
                  id: el.id,
                  className: el.className,
                  attributes: el.attributes || {},
                  boundingRect: el.rect,
                  computedStyles: { ...(el.styles || {}), ...(styleData?.computedStyles || {}) },
                  eventHandlers: eventData?.eventHandlers || el.events || [],
                  children: structData?.children || [],
                  scrollInfo: structData?.scroll || {
                      scrollTop: 0, scrollLeft: 0, scrollHeight: 0, scrollWidth: 0, clientHeight: 0, clientWidth: 0
                  },
                  animations: animData ? [animData.animation, animData.transition].filter(Boolean) : [],
                  relatedAssets: [], // To be populated from global assets if linked
                  path: el.path
              };
          });
      }

      this.cache = {
          elements: elements,
          timestamp: Date.now(),
          pageUrl: '', // Need to get this from somewhere
          mutations: []
      };

      return this.cache;
  }
}
