import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import LoginForm from '../components/LoginForm'
import { ADELHEID_PARAGRAPHS } from '../content/adelheid'
import { resolveImageUrl } from '../utils/imageUrl'

export default function LoginPage() {
  return (
    <Layout>
      <div className="p-6 max-w-4xl">
        <div className="grid gap-8 md:grid-cols-2 items-start">
          <section className="bg-fe-bg p-6">
            <img
              src={resolveImageUrl('FrauErica5.jpg')}
              alt="Portrait of Adelheid Rickmeyer"
              className="w-full max-w-[240px] mx-auto mb-4 rounded-sm"
            />
            <h2 className="text-lg font-bold text-fe-brown mb-2">
              Meet Adelheid Rickmeyer
            </h2>
            <div className="space-y-3 text-sm">
              {ADELHEID_PARAGRAPHS.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section>
            <h1 className="text-2xl sm:text-3xl font-bold mb-8">Welcome</h1>
            <LoginForm />
            <p className="text-sm text-fe-ink/70 mt-6">
              Not sure if you have access?{' '}
              <Link to="/about" className="text-fe-accent hover:text-fe-accent-dark">
                See who has access and how to request it
              </Link>
              , or{' '}
              <Link to="/contact" className="text-fe-accent hover:text-fe-accent-dark">
                contact the Archivist
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </Layout>
  )
}
