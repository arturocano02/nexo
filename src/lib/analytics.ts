/**
 * Analytics tracking utilities for user interactions
 */

import { track } from '@vercel/analytics'

export interface AnalyticsEvent {
  action: string
  category: string
  label?: string
  value?: number
}

// Predefined event types for consistency
export const ANALYTICS_EVENTS = {
  // Survey events
  SURVEY_STARTED: { action: 'survey_started', category: 'survey' },
  SURVEY_COMPLETED: { action: 'survey_completed', category: 'survey' },
  SURVEY_ABANDONED: { action: 'survey_abandoned', category: 'survey' },
  
  // Views events
  VIEWS_REFRESHED: { action: 'views_refreshed', category: 'views' },
  VIEWS_FORCE_REFRESHED: { action: 'views_force_refreshed', category: 'views' },
  VIEWS_TAB_SWITCHED: { action: 'views_tab_switched', category: 'views' },
  VIEWS_CHART_VIEWED: { action: 'views_chart_viewed', category: 'views' },
  
  // Chat events
  CHAT_MESSAGE_SENT: { action: 'chat_message_sent', category: 'chat' },
  CHAT_STARTED: { action: 'chat_started', category: 'chat' },
  
  // Party events
  PARTY_REFRESHED: { action: 'party_refreshed', category: 'party' },
  PARTY_VIEWED: { action: 'party_viewed', category: 'party' },
  
  // Navigation events
  PAGE_VIEWED: { action: 'page_viewed', category: 'navigation' },
  NAVIGATION_CLICKED: { action: 'navigation_clicked', category: 'navigation' },
  
  // Error events
  ERROR_OCCURRED: { action: 'error_occurred', category: 'error' },
  API_ERROR: { action: 'api_error', category: 'error' },
} as const

/**
 * Track a custom analytics event
 */
export function trackEvent(event: AnalyticsEvent) {
  try {
    const properties: Record<string, any> = {
      category: event.category,
    }
    
    if (event.label !== undefined) {
      properties.label = event.label
    }
    
    if (event.value !== undefined) {
      properties.value = event.value
    }
    
    track(event.action, properties)
  } catch (error) {
    console.warn('Analytics tracking failed:', error)
  }
}

/**
 * Track page views
 */
export function trackPageView(page: string) {
  trackEvent({
    ...ANALYTICS_EVENTS.PAGE_VIEWED,
    label: page,
  })
}

/**
 * Track survey interactions
 */
export function trackSurveyEvent(event: keyof typeof ANALYTICS_EVENTS, label?: string) {
  trackEvent({
    ...ANALYTICS_EVENTS[event],
    label,
  })
}

/**
 * Track views interactions
 */
export function trackViewsEvent(event: keyof typeof ANALYTICS_EVENTS, label?: string, value?: number) {
  trackEvent({
    ...ANALYTICS_EVENTS[event],
    label,
    value,
  })
}

/**
 * Track chat interactions
 */
export function trackChatEvent(event: keyof typeof ANALYTICS_EVENTS, label?: string) {
  trackEvent({
    ...ANALYTICS_EVENTS[event],
    label,
  })
}

/**
 * Track party interactions
 */
export function trackPartyEvent(event: keyof typeof ANALYTICS_EVENTS, label?: string) {
  trackEvent({
    ...ANALYTICS_EVENTS[event],
    label,
  })
}

/**
 * Track errors
 */
export function trackError(error: string, context?: string) {
  trackEvent({
    ...ANALYTICS_EVENTS.ERROR_OCCURRED,
    label: `${error}${context ? ` - ${context}` : ''}`,
  })
}

/**
 * Track API errors
 */
export function trackApiError(endpoint: string, statusCode: number, error: string) {
  trackEvent({
    ...ANALYTICS_EVENTS.API_ERROR,
    label: `${endpoint} - ${statusCode}`,
    value: statusCode,
  })
}
