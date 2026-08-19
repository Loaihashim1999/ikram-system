import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FamilySummary from '../FamilySummary'

describe('FamilySummary Component', () => {
  const sampleBeneficiary = {
    family_members_count: 5,
    working_members_count: 2,
    non_working_children_count: 3,
    father_status: 'deceased',
    mother_status: 'alive',
  }

  it('renders compact mode with total members', () => {
    render(<FamilySummary beneficiary={sampleBeneficiary} compact={true} />)
    expect(screen.getByText('5 أفراد')).toBeInTheDocument()
  })

  it('renders detailed mode with workers, children, and parent status', () => {
    render(<FamilySummary beneficiary={sampleBeneficiary} compact={false} />)
    expect(screen.getByText('5 أفراد الأسرة')).toBeInTheDocument()
    expect(screen.getByText('2 عاملين · 3 أبناء غير عاملين')).toBeInTheDocument()
    expect(screen.getByText('الأب: متوفى · الأم: حي')).toBeInTheDocument()
  })
})
