import axios from 'axios'
import { getAccessToken, signOut } from './session'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' })

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// An expired or revoked session sends the user back to the login screen.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) signOut()
    return Promise.reject(error)
  }
)

export default api
