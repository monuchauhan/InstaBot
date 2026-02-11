import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Pricing.css';

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
    <div className="pricing-page">
      <div className="pricing-container">
        {/* Header */}
        <div className="pricing-header">
          <h1>Simple, Transparent Pricing</h1>
          <p>Choose the plan that fits your needs. Upgrade or downgrade anytime.</p>
        </div>

        {/* Pricing Cards */}
        <div className="pricing-grid">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`pricing-card ${tier.highlighted ? 'highlighted' : ''}`}
            >
              {tier.highlighted && (
                <div className="popular-badge">Most Popular</div>
              )}
              
              <div className="pricing-card-content">
                <h3>{tier.name}</h3>
                <p className="description">{tier.description}</p>
                
                <div className="pricing-amount">
                  <span className="price">{tier.price}</span>
                  <span className="period">/{tier.period}</span>
                </div>

                <button
                  onClick={() => handleSelectPlan(tier)}
                  className={`pricing-button ${tier.highlighted ? 'primary' : 'secondary'}`}
                  disabled={currentTier === tier.tier}
                >
                  {currentTier === tier.tier ? 'Current Plan' : tier.buttonText}
                </button>

                <p className="features-title">What's included:</p>
                <ul className="features-list">
                  {tier.features.map((feature, index) => (
                    <li key={index}>
                      <span className="feature-check">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="faq-section">
          <h2>Frequently Asked Questions</h2>
          
          <div className="faq-list">
            <div className="faq-item">
              <h3>Can I cancel anytime?</h3>
              <p>Yes! You can cancel your subscription at any time. Your access will continue until the end of your billing period.</p>
            </div>
            
            <div className="faq-item">
              <h3>What payment methods do you accept?</h3>
              <p>We accept all major credit cards including Visa, Mastercard, and American Express through our secure payment processor.</p>
            </div>
            
            <div className="faq-item">
              <h3>Do I need a Professional Instagram account?</h3>
              <p>Yes, our automation features require a Professional (Business or Creator) Instagram account connected to a Facebook Page.</p>
            </div>
            
            <div className="faq-item">
              <h3>Is my data secure?</h3>
              <p>Absolutely. We use industry-standard encryption (AES-256) to protect your access tokens and never store your Instagram password.</p>
            </div>
          </div>
        </div>

        {/* Back to Dashboard */}
        {user && (
          <button className="back-link" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
        )}
      </div>
    </div>
  );
};

export default Pricing;
