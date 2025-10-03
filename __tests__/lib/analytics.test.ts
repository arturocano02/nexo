/**
 * @jest-environment jsdom
 */

import { 
  trackEvent, 
  trackPageView, 
  trackSurveyEvent, 
  trackViewsEvent, 
  trackChatEvent, 
  trackPartyEvent, 
  trackError, 
  trackApiError,
  ANALYTICS_EVENTS 
} from '@/src/lib/analytics'

// Mock @vercel/analytics
const mockTrack = jest.fn()
jest.mock('@vercel/analytics/react', () => ({
  track: mockTrack,
}))

describe('Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('trackEvent', () => {
    it('calls track with correct parameters', () => {
      trackEvent({
        action: 'test_action',
        category: 'test_category',
        label: 'test_label',
        value: 42
      })

      expect(mockTrack).toHaveBeenCalledWith('test_action', {
        category: 'test_category',
        label: 'test_label',
        value: 42
      })
    })

    it('handles missing optional parameters', () => {
      trackEvent({
        action: 'test_action',
        category: 'test_category'
      })

      expect(mockTrack).toHaveBeenCalledWith('test_action', {
        category: 'test_category',
        label: undefined,
        value: undefined
      })
    })
  })

  describe('trackPageView', () => {
    it('tracks page view with correct event', () => {
      trackPageView('test-page')
      
      expect(mockTrack).toHaveBeenCalledWith('page_viewed', {
        category: 'navigation',
        label: 'test-page',
        value: undefined
      })
    })
  })

  describe('trackSurveyEvent', () => {
    it('tracks survey started event', () => {
      trackSurveyEvent('SURVEY_STARTED', 'test-survey')
      
      expect(mockTrack).toHaveBeenCalledWith('survey_started', {
        category: 'survey',
        label: 'test-survey',
        value: undefined
      })
    })

    it('tracks survey completed event', () => {
      trackSurveyEvent('SURVEY_COMPLETED')
      
      expect(mockTrack).toHaveBeenCalledWith('survey_completed', {
        category: 'survey',
        label: undefined,
        value: undefined
      })
    })
  })

  describe('trackViewsEvent', () => {
    it('tracks views refreshed event', () => {
      trackViewsEvent('VIEWS_REFRESHED', 'success', 100)
      
      expect(mockTrack).toHaveBeenCalledWith('views_refreshed', {
        category: 'views',
        label: 'success',
        value: 100
      })
    })
  })

  describe('trackChatEvent', () => {
    it('tracks chat message sent event', () => {
      trackChatEvent('CHAT_MESSAGE_SENT', 'success')
      
      expect(mockTrack).toHaveBeenCalledWith('chat_message_sent', {
        category: 'chat',
        label: 'success',
        value: undefined
      })
    })
  })

  describe('trackPartyEvent', () => {
    it('tracks party refreshed event', () => {
      trackPartyEvent('PARTY_REFRESHED', 'success')
      
      expect(mockTrack).toHaveBeenCalledWith('party_refreshed', {
        category: 'party',
        label: 'success',
        value: undefined
      })
    })
  })

  describe('trackError', () => {
    it('tracks error with context', () => {
      trackError('test_error', 'test_context')
      
      expect(mockTrack).toHaveBeenCalledWith('error_occurred', {
        category: 'error',
        label: 'test_error - test_context',
        value: undefined
      })
    })

    it('tracks error without context', () => {
      trackError('test_error')
      
      expect(mockTrack).toHaveBeenCalledWith('error_occurred', {
        category: 'error',
        label: 'test_error',
        value: undefined
      })
    })
  })

  describe('trackApiError', () => {
    it('tracks API error with status code', () => {
      trackApiError('/api/test', 404, 'Not Found')
      
      expect(mockTrack).toHaveBeenCalledWith('api_error', {
        category: 'error',
        label: '/api/test - 404',
        value: 404
      })
    })
  })

  describe('ANALYTICS_EVENTS', () => {
    it('contains all expected event definitions', () => {
      expect(ANALYTICS_EVENTS.SURVEY_STARTED).toEqual({
        action: 'survey_started',
        category: 'survey'
      })
      expect(ANALYTICS_EVENTS.VIEWS_REFRESHED).toEqual({
        action: 'views_refreshed',
        category: 'views'
      })
      expect(ANALYTICS_EVENTS.CHAT_MESSAGE_SENT).toEqual({
        action: 'chat_message_sent',
        category: 'chat'
      })
      expect(ANALYTICS_EVENTS.ERROR_OCCURRED).toEqual({
        action: 'error_occurred',
        category: 'error'
      })
    })
  })
})
