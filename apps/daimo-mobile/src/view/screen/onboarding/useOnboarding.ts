// Tracks onboarding state
export function useOnboarding() {
  const [onboarding, setOnboarding] = useState(false);

  const onboardingComplete = () => setOnboarding(false);

  return { onboarding, onboardingComplete };
}
