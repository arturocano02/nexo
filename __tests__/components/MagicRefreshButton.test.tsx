/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import MagicRefreshButton from '@/src/components/MagicRefreshButton'

// Mock the analytics module
jest.mock('@/src/lib/analytics', () => ({
  trackViewsEvent: jest.fn(),
  trackError: jest.fn(),
}))

describe('MagicRefreshButton', () => {
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

  it('renders with default text and sparkle emoji', () => {
    render(<MagicRefreshButton />)
    expect(screen.getByText('Refresh Views')).toBeInTheDocument()
    expect(screen.getByText('✨')).toBeInTheDocument()
  })

  it('renders with custom children', () => {
    render(<MagicRefreshButton>Custom Text</MagicRefreshButton>)
    expect(screen.getByText('Custom Text')).toBeInTheDocument()
  })

  it('shows loading state with spinner when clicked', async () => {
    render(<MagicRefreshButton />)
    const button = screen.getByRole('button')
    
    fireEvent.click(button)
    
    expect(screen.getByText('Refreshing...')).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('applies magic styling when animating', async () => {
    render(<MagicRefreshButton />)
    const button = screen.getByRole('button')
    
    fireEvent.click(button)
    
    // Check for gradient background during animation
    expect(button).toHaveClass('bg-gradient-to-r')
  })

  it('calls onSuccess callback on successful refresh', async () => {
    const onSuccess = jest.fn()
    render(<MagicRefreshButton onSuccess={onSuccess} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('handles different variants correctly', () => {
    render(<MagicRefreshButton variant="party">Party Refresh</MagicRefreshButton>)
    expect(screen.getByText('Party Refresh')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<MagicRefreshButton className="custom-class" />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })
})
