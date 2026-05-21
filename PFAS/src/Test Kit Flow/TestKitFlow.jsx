import { buildFlowSteps } from '../utils/status.js'
import './TestKitFlow.css'

const flowSteps = buildFlowSteps()

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
            <div className="tkf-icon-track">
              <div className="tkf-icon">
                <FlowIcon name={step.icon} />
              </div>
              {index < flowSteps.length - 1 ? (
                <span className="tkf-arrow" aria-hidden="true" />
              ) : null}
            </div>

            <h3>
              {step.title}
              {step.subtitle && <span>{step.subtitle}</span>}
            </h3>

            {step.description ? <p>{step.description}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}

export default TestKitFlow
