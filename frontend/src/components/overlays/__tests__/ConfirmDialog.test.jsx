import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ConfirmDialog from '../ConfirmDialog'

describe('ConfirmDialog Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ConfirmDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title, message, and buttons when isOpen is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="تأكيد حذف المستفيد"
        message="هل تريد حذف هذا المستفيد؟"
      />
    )
    expect(screen.getByText('تأكيد حذف المستفيد')).toBeInTheDocument()
    expect(screen.getByText('هل تريد حذف هذا المستفيد؟')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const handleConfirm = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    )
    const confirmButton = screen.getByRole('button', { name: /حذف نهائياً/i })
    fireEvent.click(confirmButton)
    expect(handleConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when cancel button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
      />
    )
    const cancelButton = screen.getByRole('button', { name: /إلغاء/i })
    fireEvent.click(cancelButton)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
