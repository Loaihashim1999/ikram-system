import React from 'react'
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

globalThis.React = React

afterEach(() => {
  cleanup()
})

const storage = new Map();
const testStorage = { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() };
Object.defineProperty(globalThis, 'localStorage', { value: testStorage, configurable: true });
Object.defineProperty(window, 'localStorage', { value: testStorage, configurable: true });
