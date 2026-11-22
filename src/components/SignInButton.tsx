/**
 * "Sign in to …" for signed-out visitors, in place of a control that needs
 * an account (helpful, bookmark, comment). Opens the SDK's sign-in overlay
 * instead of letting the action fail.
 */

import { useState, type ReactNode } from 'react'
import { AuthOverlay } from 'deepspace'
import { Button, type ButtonProps } from '@/components/ui'

interface SignInButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  children: ReactNode
}

export function SignInButton({ children, variant = 'outline', size = 'sm', ...props }: SignInButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} {...props}>
        {children}
      </Button>
      {open && <AuthOverlay onClose={() => setOpen(false)} />}
    </>
  )
}
