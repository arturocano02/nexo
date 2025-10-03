/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import RefreshViewsButton from '@/src/components/RefreshViewsButton'

// Mock the analytics module
jest.mock('@/src/lib/analytics', () => ({
  trackViewsEvent: jest.fn(),
  trackError: jest.fn(),
}))

describe('RefreshViewsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock successful fetch response
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: {
          pillarsDelta: {
            economy: 5,
            social: -2,
            environment: 3
          }
        }
      })
    })
  })

  it('renders with default text', () => {
    render(<RefreshViewsButton />)
    expect(screen.getByText('Refresh Views')).toBeInTheDocument()
  })

  it('renders with custom children', () => {
    render(<RefreshViewsButton>Custom Text</RefreshViewsButton>)
    expect(screen.getByText('Custom Text')).toBeInTheDocument()
  })

  it('shows loading state when clicked', async () => {
    render(<RefreshViewsButton />)
    const button = screen.getByRole('button')
    
    fireEvent.click(button)
    
    expect(screen.getByText('Refreshing...')).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('calls onSuccess callback on successful refresh', async () => {
    const onSuccess = jest.fn()
    render(<RefreshViewsButton onSuccess={onSuccess} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'))
    
    render(<RefreshViewsButton />)
    const button = screen.getByRole('button')
    
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(screen.getByText('Refreshing...')).not.toBeInTheDocument()
    })
  })

  it('applies custom className', () => {
    render(<RefreshViewsButton className="custom-class" />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })
})
