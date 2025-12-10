import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'

const emptyForm = { name: '', description: '', price: '' }

function App() {
  const [services, setServices] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    fetchServices()
  }, [])

  const totalValue = useMemo(
    () => services.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [services],
  )

  const fetchServices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setStatus({ type: 'error', message: error.message })
    } else {
      setServices(data ?? [])
      setStatus({ type: '', message: '' })
    }
    setLoading(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.description.trim() || !form.price) {
      setStatus({ type: 'error', message: 'All fields are required.' })
      return
    }

    const priceValue = Number(form.price)
    if (Number.isNaN(priceValue) || priceValue < 0) {
      setStatus({ type: 'error', message: 'Price must be a positive number.' })
      return
    }

    setSaving(true)
    if (editingId) {
      const { error, data } = await supabase
        .from('services')
        .update({
          name: form.name.trim(),
          description: form.description.trim(),
          price: priceValue,
        })
        .eq('id', editingId)
        .select()
        .single()

      if (error) {
        setStatus({ type: 'error', message: error.message })
      } else {
        setServices((prev) =>
          prev.map((item) => (item.id === editingId ? data : item)),
        )
        resetForm()
        setStatus({ type: 'success', message: 'Service updated.' })
      }
    } else {
      const { error, data } = await supabase
        .from('services')
        .insert({
          name: form.name.trim(),
          description: form.description.trim(),
          price: priceValue,
        })
        .select()
        .single()

      if (error) {
        setStatus({ type: 'error', message: error.message })
      } else {
        setServices((prev) => [data, ...prev])
        resetForm()
        setStatus({ type: 'success', message: 'Service added.' })
      }
    }
    setSaving(false)
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleEdit = (service) => {
    setEditingId(service.id)
    setForm({
      name: service.name ?? '',
      description: service.description ?? '',
      price: service.price ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    const service = services.find((item) => item.id === id)
    const confirmDelete = window.confirm(
      `Delete "${service?.name ?? 'this service'}"?`,
    )
    if (!confirmDelete) return

    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) {
      setStatus({ type: 'error', message: error.message })
    } else {
      setServices((prev) => prev.filter((item) => item.id !== id))
      if (editingId === id) resetForm()
      setStatus({ type: 'success', message: 'Service removed.' })
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Supabase CRUD</p>
          <h1>
            Service Catalog
            <span className="gradient"> Dashboard</span>
          </h1>
          <p className="subtitle">
            Capture services with rich descriptions, pricing, and instant CRUD
            actions. Data lives in Supabase so your team stays in sync.
          </p>
          <div className="hero-stats">
            <div className="pill">
              <span className="pill-label">Services</span>
              <strong>{services.length}</strong>
            </div>
            <div className="pill">
              <span className="pill-label">Total value (INR)</span>
              <strong>₹{totalValue.toFixed(2)}</strong>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <div className="badge">Live Supabase</div>
          <p className="hero-card-title">Secure, realtime storage</p>
          <p className="hero-card-body">
            CRUD operations talk directly to your Supabase project using the
            keys you provided. Edit, delete, or add services without refreshing.
          </p>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{editingId ? 'Edit service' : 'Add service'}</p>
              <h2>{editingId ? 'Update details' : 'Create new service'}</h2>
            </div>
            {editingId && (
              <button className="ghost" onClick={resetForm} disabled={saving}>
                Cancel edit
              </button>
            )}
          </div>

          {status.message && (
            <div className={`status ${status.type}`}>{status.message}</div>
          )}

          <form className="form" onSubmit={handleSubmit}>
            <label>
              <span>Name</span>
              <input
                type="text"
                placeholder="e.g. Premium Support"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                rows="3"
                placeholder="Describe the scope, deliverables, or SLAs"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                required
              />
            </label>
            <label>
              <span>Price (INR)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="250.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </label>
            <div className="actions">
              <button type="submit" className="primary" disabled={saving}>
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Save changes'
                    : 'Add service'}
              </button>
              <button type="button" className="ghost" onClick={resetForm}>
                Reset
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Services</p>
              <h2>Live collection</h2>
            </div>
            <button className="ghost" onClick={fetchServices} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="empty">Loading services…</div>
          ) : services.length === 0 ? (
            <div className="empty">
              <p>No services yet.</p>
              <p className="muted">
                Add your first service with the form on the left.
              </p>
            </div>
          ) : (
            <div className="cards">
              {services.map((service) => (
                <article key={service.id} className="card">
                  <div className="card-header">
                    <div>
                      <h3>{service.name}</h3>
                      <p className="muted">{service.description}</p>
                    </div>
                    <span className="price">₹{Number(service.price).toFixed(2)}</span>
                  </div>
                  <div className="card-footer">
                    <button
                      className="ghost"
                      onClick={() => handleEdit(service)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="danger"
                      onClick={() => handleDelete(service.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
