import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Mail,
  Moon,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import {
  enterDemoSandbox,
  loginUser,
  RegisterResponse,
  registerUser,
  resendVerificationEmail,
  verifyEmail,
} from '../api.ts';
import { Organization, User as UserType } from '../types.ts';

interface AuthViewProps {
  onAuthSuccess: (user: UserType, organization: Organization, isDemo?: boolean) => void;
  darkMode?: boolean;
  setDarkMode?: (val: boolean) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess, darkMode, setDarkMode }) => {
  const [isRegister, setIsRegister] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // UI & Feedback States
  const [loading, setLoading] = useState<boolean>(false);
  const [verifyingToken, setVerifyingToken] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Unverified Account & Resend State
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [resendNotice, setResendNotice] = useState<{
    success: boolean;
    message: string;
    devVerificationUrl?: string;
  } | null>(null);

  // Post-Registration State
  const [registeredInfo, setRegisteredInfo] = useState<RegisterResponse | null>(null);

  // Check URL params on load for verification link or status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);

    const token = urlParams.get('token');
    const verifiedParam = urlParams.get('verified');
    const verifyErrorParam = urlParams.get('verify_error');
    const emailParam = urlParams.get('email');

    if (emailParam) {
      setEmail(emailParam);
    }

    if (token) {
      setVerifyingToken(true);
      setError(null);
      verifyEmail(token)
        .then((res) => {
          setSuccessNotice('Email verified successfully. You can now sign in.');
          setIsRegister(false);
          if (res.email) setEmail(res.email);
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch((err: any) => {
          setError(err.message || 'Invalid verification link.');
          window.history.replaceState({}, '', window.location.pathname);
        })
        .finally(() => {
          setVerifyingToken(false);
        });
      return;
    }

    if (verifiedParam === 'true') {
      setSuccessNotice('Email verified successfully. You can now sign in.');
      setIsRegister(false);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (verifyErrorParam === 'expired') {
      setError('This verification link has expired. Please request a new verification email.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (verifyErrorParam === 'already_used') {
      setSuccessNotice('This email has already been verified. You can sign in.');
      setIsRegister(false);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (verifyErrorParam === 'invalid') {
      setError('Invalid verification link.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Cooldown timer for resend verification email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setResendNotice(null);
    setRegisteredInfo(null);
    setUnverifiedEmail(null);

    const cleanEmail = email.trim().toLowerCase();

    // Client validation
    if (isRegister) {
      if (name.trim().length < 2) {
        setError('Full Name is required (minimum 2 characters).');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }

      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
      if (!hasLetter || !hasNumberOrSymbol) {
        setError('Password must contain at least one letter and at least one number or special character.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Confirm Password does not match Password.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        // Register user - DO NOT auto-login!
        const res = await registerUser({
          name: name.trim(),
          email: cleanEmail,
          organizationName: organizationName.trim() || undefined,
          password,
          confirmPassword,
        });

        // Set truthful registration state
        setRegisteredInfo(res);
      } else {
        // Sign In
        const res = await loginUser({
          email: cleanEmail,
          password,
        });

        onAuthSuccess(res.user, res.organization, false);
      }
    } catch (err: any) {
      if (err.emailUnverified) {
        setUnverifiedEmail(err.email || cleanEmail);
        setError('Please verify your email before signing in.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (targetEmail?: string) => {
    const toSend = (targetEmail || unverifiedEmail || email).trim().toLowerCase();
    if (!toSend) {
      setError('Please provide an email address to resend verification.');
      return;
    }

    setResending(true);
    setResendNotice(null);
    setError(null);

    try {
      const res = await resendVerificationEmail(toSend);
      setResendNotice(res);
      setResendCooldown(60); // 60 seconds cooldown
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleManualTokenVerification = async (urlOrToken: string) => {
    try {
      setLoading(true);
      let token = urlOrToken;
      if (urlOrToken.includes('token=')) {
        const parts = urlOrToken.split('token=');
        token = parts[1].split('&')[0];
      }
      const res = await verifyEmail(decodeURIComponent(token));
      setRegisteredInfo(null);
      setResendNotice(null);
      setUnverifiedEmail(null);
      setSuccessNotice('Email verified successfully. You can now sign in.');
      setIsRegister(false);
      if (res.email) setEmail(res.email);
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSandbox = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await enterDemoSandbox();
      onAuthSuccess(res.user, res.organization, true);
    } catch (err: any) {
      setError(err.message || 'Failed to enter demo sandbox');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 transition-colors">
      {/* Day / Night Theme Toggle */}
      {setDarkMode !== undefined && (
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center space-x-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={darkMode ? 'Switch to Day theme' : 'Switch to Night theme'}
          >
            {darkMode ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>Day Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-500" />
                <span>Night Mode</span>
              </>
            )}
          </button>
        </div>
      )}

      <div className="w-full max-w-md space-y-8">
        {/* Brand / Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white font-bold text-2xl shadow-md">
            A
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            ASTRA<span className="text-teal-600 dark:text-teal-400">_V1</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Autonomous Synchronization, Transcription & Resolution Assistant
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center space-x-1.5 rounded-full border border-teal-200/60 bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-800 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>Strict Data Integrity & Real Verification</span>
            </span>
          </div>
        </div>

        {/* Verifying Token Loader */}
        {verifyingToken && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-center text-xs font-semibold text-teal-800 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
            <span>Verifying email token with secure server...</span>
          </div>
        )}

        {/* Success Notice Banner */}
        {successNotice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 flex items-start space-x-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold">{successNotice}</div>
              <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                You can now log in to access your organization workspace.
              </p>
            </div>
          </div>
        )}

        {/* Error Notice Banner */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200 flex items-start space-x-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="font-semibold">{error}</div>

              {/* If unverified email error on login: show Resend Button */}
              {unverifiedEmail && (
                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 space-y-2">
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    A verification link was sent to <strong>{unverifiedEmail}</strong>. You must verify ownership before signing in.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleResend(unverifiedEmail)}
                    disabled={resending || resendCooldown > 0}
                    className="inline-flex items-center space-x-1.5 rounded-md bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50 cursor-pointer transition-colors shadow-2xs"
                  >
                    {resending ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Mail className="h-3 w-3" />
                    )}
                    <span>
                      {resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : 'Resend verification email'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resend Result Feedback */}
        {resendNotice && (
          <div
            className={`rounded-xl border p-4 text-xs flex items-start space-x-3 ${
              resendNotice.success
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
            }`}
          >
            {resendNotice.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            )}
            <div className="flex-1 space-y-2">
              <div className="font-bold">{resendNotice.message}</div>
              {/* If dev link available */}
              {resendNotice.devVerificationUrl && (
                <div className="mt-2 rounded-lg border border-amber-300/80 bg-amber-100/60 p-2.5 dark:border-amber-800 dark:bg-amber-950/70 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="font-bold flex items-center space-x-1">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                    <span>DEVELOPMENT EMAIL VERIFICATION MODE</span>
                  </div>
                  <p className="text-[10px]">
                    Email delivery is not configured on this host. Use this development verification link:
                  </p>
                  <button
                    type="button"
                    onClick={() => handleManualTokenVerification(resendNotice.devVerificationUrl!)}
                    className="inline-flex items-center space-x-1 rounded bg-amber-800 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-900 cursor-pointer"
                  >
                    <span>Verify Email Now (Dev Mode)</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUTH CARD */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
          {/* POST-REGISTRATION SUCCESS SCREEN */}
          {registeredInfo ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 border border-teal-200 dark:border-teal-800">
                <Mail className="h-7 w-7" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Account Created
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Check your email to verify your account
                </p>
                <div className="inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {registeredInfo.email}
                </div>
              </div>

              {/* Truthful delivery status box */}
              {registeredInfo.emailSent ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-left text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 space-y-1">
                  <div className="flex items-center space-x-2 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Verification email sent. Please check your inbox.</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pl-6">
                    Click the verification link in the email to activate your account. Links expire in 24 hours.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-left text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 space-y-2">
                  <div className="flex items-center space-x-2 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{registeredInfo.emailDeliveryStatus}</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 pl-6">
                    {registeredInfo.emailProviderConfigured
                      ? 'The email provider encountered an issue sending the email. You can request a new link below.'
                      : 'SMTP or Resend credentials are not configured in the environment. In production, configure EMAIL_PROVIDER to deliver verification emails.'}
                  </p>

                  {/* Explicit Development Mode Link */}
                  {registeredInfo.devVerificationUrl && (
                    <div className="mt-2 ml-6 rounded-lg border border-amber-300 bg-white/80 p-3 dark:border-amber-800 dark:bg-slate-900/80 space-y-2">
                      <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                        <span>DEVELOPMENT EMAIL VERIFICATION MODE</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">
                        Since email delivery is unconfigured in development, click below to verify this test account:
                      </p>
                      <button
                        type="button"
                        onClick={() => handleManualTokenVerification(registeredInfo.devVerificationUrl!)}
                        className="w-full inline-flex items-center justify-center space-x-1.5 rounded-lg bg-teal-600 py-2 text-xs font-bold text-white hover:bg-teal-700 cursor-pointer transition-colors shadow-2xs"
                      >
                        <span>Verify Email Now (Dev Mode)</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setRegisteredInfo(null);
                    setIsRegister(false);
                    setError(null);
                  }}
                  className="w-full flex items-center justify-center space-x-2 rounded-lg bg-teal-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition-colors cursor-pointer"
                >
                  <span>Return to Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleResend(registeredInfo.email)}
                  disabled={resending || resendCooldown > 0}
                  className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50 cursor-pointer"
                >
                  {resending
                    ? 'Resending email...'
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend verification email'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Selector: Sign In vs Register */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setError(null);
                    setSuccessNotice(null);
                    setUnverifiedEmail(null);
                  }}
                  className={`flex-1 text-center text-xs font-bold pb-2 border-b-2 transition-colors cursor-pointer ${
                    !isRegister
                      ? 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError(null);
                    setSuccessNotice(null);
                    setUnverifiedEmail(null);
                  }}
                  className={`flex-1 text-center text-xs font-bold pb-2 border-b-2 transition-colors cursor-pointer ${
                    isRegister
                      ? 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Register Account
                </button>
              </div>

              {/* FORM */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <>
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dr. Chaitali Raut"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Organization Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Organization / Company Name
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="e.g. Apex Systems"
                          value={organizationName}
                          onChange={(e) => setOrganizationName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="name@organization.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    {isRegister && (
                      <span className="text-[10px] text-slate-400">Min 8 chars (letter + number)</span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={isRegister ? 8 : 6}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Confirm Password (Registration only) */}
                {isRegister && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full rounded-lg border py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 focus:outline-none dark:bg-slate-800 dark:text-white ${
                          confirmPassword && confirmPassword !== password
                            ? 'border-rose-400 dark:border-rose-600'
                            : 'border-slate-300 dark:border-slate-700 focus:border-teal-500'
                        }`}
                      />
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="mt-1 text-[11px] text-rose-500">Passwords do not match</p>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 rounded-lg bg-teal-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{isRegister ? 'Creating Account...' : 'Signing In...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{isRegister ? 'Create Account & Verify' : 'Sign In'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Helper Links on Login tab */}
              {!isRegister && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (!email) {
                        setError('Please enter your email above to resend verification.');
                        return;
                      }
                      handleResend(email);
                    }}
                    disabled={resending || resendCooldown > 0}
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {resendCooldown > 0
                      ? `Resend verification in ${resendCooldown}s`
                      : 'Need a verification email? Resend'}
                  </button>
                </div>
              )}

              {/* Segregated Demo Sandbox Button */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Want to inspect ASTRA with pre-loaded mock scenarios?
                </div>
                <button
                  type="button"
                  onClick={handleDemoSandbox}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 rounded-lg border border-slate-300 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Enter Isolated Demo Sandbox</span>
                </button>
                <p className="text-[10px] text-center text-slate-400 italic">
                  Demo data is segregated in a sandbox workspace and never mixed with production accounts.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] tracking-tight text-slate-400 dark:text-slate-500 pt-1">
          <span>&copy; {new Date().getFullYear()} ASTRA. All rights reserved.</span>
          <span>
            Created by <span className="font-medium text-slate-600 dark:text-slate-300">Chaitali Raut &amp; Team</span>
          </span>
        </div>
      </div>
    </div>
  );
};
