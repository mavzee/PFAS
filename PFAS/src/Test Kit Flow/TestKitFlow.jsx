import './TestKitFlow.css'

const flowSteps = [
  {
    icon: 'file-text',
    title: 'Retainer',
    subtitle: '',
    description: 'New retainer agreement has been sent to us.',
    tone: 'blue',
  },
  {
    icon: 'clipboard',
    title: 'Ordered',
    subtitle: '',
    description: 'We will then order the test kits.',
    tone: 'purple',
  },
  {
    icon: 'building',
    title: 'Eurofins',
    subtitle: '',
    description: 'Test kits are being prepared and will be shipped from Eurofins.',
    tone: 'blue',
  },
  {
    icon: 'truck',
    title: 'Outbound',
    subtitle: '(In Transit)',
    description: 'Test kits are sent out to the site/utility for use or distribution.',
    tone: 'blue',
  },
  {
    icon: 'tester',
    title: 'Pure Green Testers',
    subtitle: '',
    description: 'Pure Green testers go to the site/utility to collect water samples for testing.',
    tone: 'green',
  },
  {
    icon: 'van',
    title: 'Inbound',
    subtitle: '(In Transit)',
    description: 'After the testing, test kits will be send back to eurofins from the utility.',
    tone: 'green',
  },
  {
    icon: 'expenses',
    title: 'Invoice',
    subtitle: '',
    description: 'Invoice from Eurofins will be sent to us via email.',
    tone: 'blue',
  },
  {
    icon: 'flask',
    title: 'Test Results',
    subtitle: '',
    description: ' ',
    tone: 'green',
  },
]

function FlowIcon({ name }) {
  return <span className={`tkf-symbol tkf-symbol-${name}`} aria-hidden="true" />
}

function TestKitFlow() {
  return (
    <section className="test-kit-flow" aria-labelledby="test-kit-flow-title">
      <h2 id="test-kit-flow-title">Test Kit Flow</h2>

      <div className="tkf-steps">
        {flowSteps.map((step, index) => (
          <article className={`tkf-step tkf-${step.tone}`} key={step.title}>
            <div className="tkf-icon">
              <FlowIcon name={step.icon} />
            </div>

            <h3>
              {step.title}
              {step.subtitle && <span>{step.subtitle}</span>}
            </h3>

            <p>{step.description}</p>

            {index < flowSteps.length - 1 && (
              <span className="tkf-arrow" aria-hidden="true" />
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

export default TestKitFlow
