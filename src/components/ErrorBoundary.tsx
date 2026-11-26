import React from 'react';
import { FIREBASE_DATABASE_ID, FIREBASE_PROJECT_ID } from '../lib/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', isQuotaError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'Une erreur inattendue est survenue.';
    const isQuotaError = raw.includes('Quota exceeded');
    let friendly = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed.error) {
        friendly = parsed.error.includes('permission')
          ? `Accès refusé lors de l’opération (${parsed.operationType ?? 'lecture'}) sur ${
              parsed.path ?? 'la base'
            }. Vérifiez votre connexion Google.`
          : parsed.error;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: friendly, isQuotaError };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      const upgradeUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIREBASE_DATABASE_ID}/data?openUpgradeDialog=true`;
      return (
        <div className="min-h-screen bg-[#08131A] text-[#F3F7FA] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#0F1F2A] border border-white/10 rounded-2xl p-8">
            <h1 className="text-xl font-semibold text-[#F3F7FA]">
              Interruption temporaire
            </h1>
            <p className="mt-3 text-sm text-[#94ACB9] leading-relaxed">
              {this.state.message}
            </p>
            {this.state.isQuotaError && (
              <p className="mt-3 text-sm text-[#94ACB9] leading-relaxed">
                Le quota journalier gratuit Firestore est atteint et se réinitialisera demain.{' '}
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F0A53A] underline font-medium"
                >
                  Consulter les quotas Firestore
                </a>
              </p>
            )}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 text-sm font-semibold text-[#08131A] bg-[#F0A53A] rounded-lg hover:bg-[#F5B558] transition-colors whitespace-nowrap shrink-0"
              >
                Recharger l’application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
