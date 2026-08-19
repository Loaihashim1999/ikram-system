import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CategoryBadge from '../CategoryBadge'

describe('CategoryBadge Component', () => {
  it('renders default fallback dash when name is null or undefined', () => {
    render(<CategoryBadge name={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders badge for degree 1 with correct text', () => {
    render(<CategoryBadge name="درجة أولى" />)
    const badge = screen.getByText('درجة أولى')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-[#3B8A5E]')
  })

  it('renders badge for special needs category', () => {
    render(<CategoryBadge name="ذوي الاحتياجات الخاصة" />)
    const badge = screen.getByText('ذوي الاحتياجات الخاصة')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-[#2F6FA8]')
  })
})
