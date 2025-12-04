import { AgentContext } from '../../core/context';
import { EXTRACTORS } from './extractors';

/**
 * Represents the bounding rectangle of a DOM element.
 * A JSON-serializable replacement for the native DOMRect object.
 */
export interface BoundingRect {
  /** X coordinate of the rectangle's origin */
  x: number;
  /** Y coordinate of the rectangle's origin */
  y: number;
  /** Width of the rectangle */
  width: number;
  /** Height of the rectangle */
  height: number;
  /** Distance from the top of the viewport */
  top: number;
  /** Distance from the left of the viewport */
  left: number;
  /** Distance from the top to the bottom edge */
  bottom: number;
  /** Distance from the left to the right edge */
  right: number;
}

/**
 * Comprehensive intelligence data extracted from a DOM element.
 * Contains all relevant information about an element for AI analysis.
 */
export interface DomElementIntelligence {
  /** Stable identifier for serialization and reference */
  elementId: string;
  /** HTML tag name of the element */
  tagName: string;
  /** Optional DOM id attribute */
  id?: string;
  /** Optional CSS class names */
  className?: string;
  /** Map of all HTML attributes */
  attributes: Record<string, string>;
  /** Element's position and size information */
  boundingRect: BoundingRect;
  /** Computed CSS styles for the element */
  computedStyles: Record<string, string>;
  /** Event handlers attached to the element */
  eventHandlers: EventHandler[];
  /** Child element IDs (avoids object cycles in serialization) */
  children: string[];
  /** Scroll position and dimensions */
  scrollInfo: ScrollInfo;
  /** CSS animations applied to the element */
  animations: AnimationData[];
  /** Related assets (images, scripts, etc.) */
  relatedAssets: AssetReference[];
  /** Optional CSS selector path to the element */
  path?: string;
}

/**
 * Information about an event handler attached to a DOM element.
 */
export interface EventHandler {
  /** Event type (e.g., "click", "submit", "change") */
  type: string;
  /** Whether a handler is actually attached */
  hasHandler: boolean;
  /** Detected JavaScript framework, if applicable */
  framework?: 'react' | 'vue' | 'angular' | 'jquery';
  /** Whether the handler was defined inline in HTML */
  isInline: boolean;
  /** Optional source code of the handler (if available and safe to include) */
  source?: string;
}

/**
 * Scroll state and dimensions for a scrollable element.
 */
export interface ScrollInfo {
  /** Current vertical scroll position */
  scrollTop: number;
  /** Current horizontal scroll position */
  scrollLeft: number;
  /** Total scrollable height */
  scrollHeight: number;
  /** Total scrollable width */
  scrollWidth: number;
  /** Visible viewport height */
  clientHeight: number;
  /** Visible viewport width */
  clientWidth: number;
}

/**
 * CSS animation or transition data for an element.
 */
export interface AnimationData {
  /** Animation name (for keyframe animations) */
  name: string;
  /** Duration in milliseconds */
  duration: number;
  /** Delay before animation starts in milliseconds */
  delay: number;
  /** CSS timing function (e.g., "ease", "linear") */
  timingFunction: string;
  /** CSS properties being animated */
  properties?: string[];
  /** Number of times animation repeats (or "infinite") */
  iterationCount?: string;
}

/**
 * Reference to an asset related to a DOM element.
 */
export interface AssetReference {
  /** Type of asset */
  type: 'image' | 'video' | 'audio' | 'icon' | 'stylesheet' | 'script';
  /** URL of the asset */
  url: string;
  /** Element ID that references this asset */
  elementId?: string;
}

/**
 * Summary of a DOM mutation event.
 */
export interface MutationSummary {
  /** Type of mutation that occurred */
  type: 'attributes' | 'childList' | 'characterData';
  /** ID of the element that was mutated */
  targetId: string;
  /** Name of the changed attribute (for attribute mutations) */
  attributeName?: string;
  /** IDs of newly added child elements */
  addedNodes?: string[];
  /** IDs of removed child elements */
  removedNodes?: string[];
}

/**
 * Complete DOM intelligence cache containing all extracted element data.
 */
export interface DomIntelligenceCache {
  /** Map of element IDs to their intelligence data */
  elements: Record<string, DomElementIntelligence>;
  /** Timestamp when the cache was created */
  timestamp: number;
  /** URL of the page when intelligence was gathered */
  pageUrl: string;
  /** Mutations observed since last cache update */
  mutations: MutationSummary[];
}

/**
 * Agent for extracting comprehensive DOM intelligence from web pages.
 * Runs multiple extractors in parallel to gather element information,
 * styles, events, animations, and assets.
 */
export class DomIntelligenceAgent {
  /** Agent context for accessing shared resources */
  private context: AgentContext;
  /** Map of extractor names to their implementation functions */
  private extractors: Map<string, Function> = new Map();
  /** Cached intelligence data with TTL */
  private cache: DomIntelligenceCache | null = null;

  /**
   * Creates a new DomIntelligenceAgent.
   * @param context - The agent context for shared resources and configuration.
   */
  constructor(context: AgentContext) {
    this.context = context;
    this.loadExtractors();
  }

  /**
   * Loads all available extractors into the extractors map.
   * Called during construction to prepare extractors for execution.
   */
  private loadExtractors() {
    Object.entries(EXTRACTORS).forEach(([name, content]) => {
      this.extractors.set(name, content);
    });
  }

  /**
   * Executes multiple extractors in parallel and collects their results.
   * @param executor - Function that executes an extractor script in the browser context.
   * @param extractorNames - Optional array of extractor names to run. Defaults to all extractors.
   * @returns A promise resolving to a map of extractor names to their results.
   */
  async runExtractorsParallel(
    executor: (script: Function) => Promise<any>,
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

  /**
   * Gathers comprehensive DOM intelligence by running all extractors.
   * Results are cached with a 5-second TTL to avoid redundant extraction.
   * @param executor - Function that executes extractor scripts in the browser context.
   * @param useCache - Whether to return cached results if available and fresh.
   * @returns A promise resolving to the complete DOM intelligence cache.
   * @throws Error if the comprehensive element extractor fails.
   */
  async getIntelligence(
      executor: (script: Function) => Promise<any>,
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
