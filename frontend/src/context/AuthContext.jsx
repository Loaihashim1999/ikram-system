import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const login = async (username, password) => {
    try {
      const response = await api.post('/login', { username, password });
      const { token, user } = response.data.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'حدث خطأ أثناء تسجيل الدخول' 
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  const fetchUser = async () => {
    const requestToken = localStorage.getItem('token');
    try {
      const response = await api.get('/me');
      if (localStorage.getItem('token') !== requestToken) return;
      const userData = response.data.data;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      if (error.response?.status === 401 && localStorage.getItem('token') === requestToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key === 'token' || event.key === 'user') {
        setToken(localStorage.getItem('token'));
        try { setUser(JSON.parse(localStorage.getItem('user') || 'null')); }
        catch { setUser(null); }
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
