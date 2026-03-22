import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  buttonText: string;
  tier: 'free' | 'pro' | 'enterprise';
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out the platform',
    tier: 'free',
    features: [
      '1 Instagram Account',
      '2 Automations',
      'Auto-reply comments',
      '50 actions per day',
      'Basic support',
    ],
    buttonText: 'Get Started',
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For growing creators and businesses',
    tier: 'pro',
    highlighted: true,
    features: [
      '5 Instagram Accounts',
      '10 Automations',
      'Auto-reply comments',
      'Send DMs',
      'Analytics dashboard',
      '500 actions per day',
      'Priority support',
    ],
    buttonText: 'Upgrade to Pro',
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: 'per month',
    description: 'For agencies and large businesses',
    tier: 'enterprise',
    features: [
      'Unlimited Instagram Accounts',
      'Unlimited Automations',
      'All features included',
      'API access',
      'Unlimited actions',
      'Dedicated support',
      'Custom integrations',
    ],
    buttonText: 'Contact Sales',
  },
];

const Pricing: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSelectPlan = (tier: PricingTier) => {
    if (!user) {
      navigate('/register');
      return;
    }

    if (tier.tier === 'free') {
      navigate('/dashboard');
    } else if (tier.tier === 'enterprise') {
      window.location.href = 'mailto:sales@yourdomain.com?subject=Enterprise%20Plan%20Inquiry';
    } else {
      // TODO: Integrate with Stripe for Pro plan
      alert('Stripe integration coming soon! Contact us for early access.');
    }
  };

  const currentTier = (user as any)?.subscription_tier;

  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-5xl font-headline font-extrabold text-on-surface mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-on-surface-variant text-lg max-w-xl mx-auto">
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative bg-surface-container-lowest rounded-2xl p-8 shadow-sm flex flex-col ${
                tier.highlighted
                  ? 'ring-2 ring-primary shadow-lg scale-[1.02]'
                  : ''
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-headline font-extrabold text-on-surface mb-1">
                {tier.name}
              </h3>
              <p className="text-sm text-on-surface-variant mb-6">
                {tier.description}
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-headline font-extrabold text-on-surface">
                  {tier.price}
                </span>
                <span className="text-sm text-outline">/{tier.period}</span>
              </div>

              <button
                onClick={() => handleSelectPlan(tier)}
                className={`w-full py-3 rounded-xl font-bold transition-all active:scale-95 mb-8 ${
                  tier.highlighted
                    ? 'bg-gradient-to-br from-primary to-primary-container text-white shadow-lg shadow-primary/20 hover:opacity-90'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                } disabled:opacity-50`}
                disabled={currentTier === tier.tier}
              >
                {currentTier === tier.tier ? 'Current Plan' : tier.buttonText}
              </button>

              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-4">
                What&apos;s included
              </p>
              <ul className="space-y-3 flex-1">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-sm text-on-surface-variant">
                    <span
                      className="material-symbols-outlined text-primary text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl font-headline font-extrabold text-on-surface text-center mb-10">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: 'Can I cancel anytime?',
                a: 'Yes! You can cancel your subscription at any time. Your access will continue until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards including Visa, Mastercard, and American Express through our secure payment processor.',
              },
              {
                q: 'Do I need a Professional Instagram account?',
                a: 'Yes, our automation features require a Professional (Business or Creator) Instagram account connected to a Facebook Page.',
              },
              {
                q: 'Is my data secure?',
                a: 'Absolutely. We use industry-standard encryption (AES-256) to protect your access tokens and never store your Instagram password.',
              },
            ].map((faq, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-on-surface mb-2">{faq.q}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Back to Dashboard */}
        {user && (
          <div className="text-center">
            <button
              className="text-primary font-bold hover:underline"
              onClick={() => navigate('/dashboard')}
            >
              ← Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pricing;
