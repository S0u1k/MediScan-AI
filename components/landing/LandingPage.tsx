"use client";

import { useProtectedAction } from "@/hooks/useProtectedAction";
import { AuthModal } from "./AuthModal";
import { BottomQuote } from "./BottomQuote";
import { BrandHeader } from "./BrandHeader";
import { HeroContent } from "./HeroContent";
import { HeroPanel } from "./HeroPanel";

export function LandingPage() {
  const {
    identityLabel,
    isAuthenticated,
    isModalOpen,
    closeModal,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    requestProtectedAction,
  } = useProtectedAction();

  return (
    <>
      {/* Earth/space background is rendered globally in app/layout.tsx (z-0/z-[1]) */}

      {/* z-10 UI content */}
      <main className="relative z-10 flex min-h-screen w-full items-center justify-center p-4 sm:p-8">
        <HeroPanel>
          <BrandHeader
            identityLabel={identityLabel}
            isAuthenticated={isAuthenticated}
            onSignOut={signOut}
            onMenuActivate={() =>
              requestProtectedAction(undefined, document.activeElement as HTMLElement)
            }
          />

          <HeroContent
            onPrimaryAction={(el) => requestProtectedAction(undefined, el)}
            onFeatureAction={(_label, el) =>
              requestProtectedAction(undefined, el)
            }
          />

          <BottomQuote />
        </HeroPanel>
      </main>

      <AuthModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onEmailSubmit={(email, password) => signIn(email, password)}
        onEmailSignUp={(email, password) => signUp(email, password)}
        onGoogleSignIn={signInWithGoogle}
      />
    </>
  );
}
