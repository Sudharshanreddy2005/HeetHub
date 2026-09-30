import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('shows the public landing page at the root route with a product hero and feature grid', () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'AI Powered Meetings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument()

    // Hero action buttons
    expect(screen.getByRole('button', { name: /Start a meeting for free/i })).toBeInTheDocument()
    const joinButton = screen.getByRole('button', { name: /Join a meeting/i })
    expect(joinButton).toBeInTheDocument()

    // Bento grid feature headings
    expect(screen.getByRole('heading', { name: 'Voice Moderation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Toxicity Filtering' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Visual Engagement Estimation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Screen Collaboration' })).toBeInTheDocument()

    // Modal dialog opens on clicking 'Join a meeting'
    fireEvent.click(joinButton)
    expect(screen.getByRole('heading', { name: 'Join with Meeting ID' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Meeting ID \/ Code/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Meeting Passcode/i)).toBeInTheDocument()

    // Close button closes the modal
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('heading', { name: 'Join with Meeting ID' })).not.toBeInTheDocument()
  })

  it('shows the login page at /login', () => {
    window.history.pushState({}, '', '/login')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.queryByText('Remember me')).not.toBeInTheDocument()
    expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument()
  })

  it('shows invalid credentials instead of an expired-session error for a login 401', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid email or password' }),
    } as Response)
    localStorage.removeItem('access_token')
    window.history.pushState({}, '', '/login')
    render(<App />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'incorrect-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    try {
      expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
      expect(screen.queryByText('Your session has expired. Please sign in again.')).not.toBeInTheDocument()
    } finally {
      fetchMock.mockRestore()
    }
  })

  it('requires authentication for a direct /meetings visit', () => {
    localStorage.removeItem('access_token')
    window.history.pushState({}, '', '/meetings')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('renders authenticated meetings inside the shared shell and searches real records', async () => {
    const user = { id: 'user-1', username: 'sudharshan', email: 'user@example.com', full_name: 'Sudharshan', phone: '', role: 'participant', created_at: '' }
    const meeting = { id: 'meeting-1', title: 'Planning Review', description: 'Roadmap', scheduled_at: '2026-10-01T10:00:00Z', duration_minutes: 30, status: 'SCHEDULED', host_username: 'sudharshan', participants: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      const body = url.includes('/auth/me') ? user : url.includes('/meetings/upcoming') ? [meeting] : []
      return { ok: true, json: async () => body } as Response
    })
    localStorage.setItem('access_token', 'test-token')
    window.history.pushState({}, '', '/meetings')
    render(<App />)

    const search = await screen.findByRole('searchbox', { name: 'Search meetings and invitations' })
    expect(screen.getByText('MeetHub workspace')).toBeInTheDocument()
    expect(document.querySelector('.header-username')).toHaveTextContent('sudharshan')
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: 'Planning' } })

    expect(await screen.findByRole('option', { name: /Planning Review/ })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalled()

    fetchMock.mockRestore()
    localStorage.removeItem('access_token')
  })

  it('shows the registration page at /register with validation rules and error feedback', () => {
    window.history.pushState({}, '', '/register')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: 'Create account' })
    expect(createBtn).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()

    // 1. Validate full name: must be string of letters, cannot contain numbers
    const nameInput = screen.getByLabelText(/Full name/i)
    fireEvent.change(nameInput, { target: { value: 'Jane123' } })
    fireEvent.blur(nameInput)
    expect(screen.getByText('Full name must contain only letters and cannot contain numbers.')).toBeInTheDocument()

    // Correct full name
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } })
    fireEvent.blur(nameInput)
    expect(screen.queryByText('Full name must contain only letters and cannot contain numbers.')).not.toBeInTheDocument()

    // 2. Accept any valid email domain and reject malformed addresses.
    const emailInput = screen.getByLabelText(/Email address/i)
    fireEvent.change(emailInput, { target: { value: 'jane@yahoo.com' } })
    fireEvent.blur(emailInput)
    expect(screen.queryByText('Please enter a valid email address.')).not.toBeInTheDocument()

    fireEvent.change(emailInput, { target: { value: 'jane@' } })
    fireEvent.blur(emailInput)
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument()

    // Correct email
    fireEvent.change(emailInput, { target: { value: 'janedoe@gmail.com' } })
    fireEvent.blur(emailInput)
    expect(screen.queryByText('Please enter a valid email address.')).not.toBeInTheDocument()

    // 3. Validate phone: number in int (digits only, no letters)
    const phoneInput = screen.getByLabelText(/Phone number/i)
    fireEvent.change(phoneInput, { target: { value: 'phone12345' } })
    fireEvent.blur(phoneInput)
    expect(screen.getByText('Phone number must contain only numeric digits (no letters).')).toBeInTheDocument()

    // Correct phone
    fireEvent.change(phoneInput, { target: { value: '9876543210' } })
    fireEvent.blur(phoneInput)
    expect(screen.queryByText('Phone number must contain only numeric digits (no letters).')).not.toBeInTheDocument()

    // 4. Validate username
    const usernameInput = screen.getByLabelText(/Username/i)
    fireEvent.change(usernameInput, { target: { value: '12invalid' } })
    fireEvent.blur(usernameInput)
    expect(screen.getByText('Username must start with a letter.')).toBeInTheDocument()

    fireEvent.change(usernameInput, { target: { value: 'janedoe' } })
    fireEvent.blur(usernameInput)
    expect(screen.queryByText('Username must start with a letter.')).not.toBeInTheDocument()

    // 5. Validate password complexity
    const passwordInput = screen.getByLabelText(/^Password \*/i)
    fireEvent.change(passwordInput, { target: { value: 'weak' } })
    fireEvent.blur(passwordInput)
    expect(screen.getByText('Password must be at least 8 characters long.')).toBeInTheDocument()

    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } })
    fireEvent.blur(passwordInput)
    expect(screen.queryByText('Password must be at least 8 characters long.')).not.toBeInTheDocument()

    // 6. Validate password and confirmed password must match
    const confirmInput = screen.getByLabelText(/Confirm password/i)
    fireEvent.change(confirmInput, { target: { value: 'Different123!' } })
    fireEvent.blur(confirmInput)
    expect(screen.getByText('Password and confirmed password must match.')).toBeInTheDocument()

    // Fix confirmed password to match
    fireEvent.change(confirmInput, { target: { value: 'Secret123!' } })
    fireEvent.blur(confirmInput)
    expect(screen.queryByText('Password and confirmed password must match.')).not.toBeInTheDocument()
  })
})


