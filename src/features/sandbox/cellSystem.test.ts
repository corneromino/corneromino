import { describe, expect, it } from 'vitest'
import { SandboxCellSystem, updatePowerStateFromNeighbors } from './cellSystem'

describe('SandboxCellSystem', () => {
  it('rotates only the corner selected by the user', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ])

    system.rotateCornerFromUser('0,0')
    system.processUpdates(1)

    expect(system.getState('0,0')?.corner).toBe(2)
    expect(system.getState('1,0')?.corner).toBe(1)
    expect(system.getState('0,1')).toBeUndefined()
  })

  it('does not notify neighbors when no update handler requests it', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ])

    system.rotateCornerFromUser('0,0')
    expect(system.getState('0,0')?.corner).toBe(2)
    expect(system.getState('1,0')?.corner).toBe(1)
    expect(system.hasPendingUpdates()).toBe(false)
  })

  it('allows update handlers to change a corneromino on/off state', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ], [
      (target, cellKey, state, previousState) => {
        const nextState = { ...state, isOn: true, sourceKey: '0,-1' }
        target.setCornerStateFromUpdate(cellKey, nextState)
        return previousState?.isOn !== nextState.isOn || previousState?.sourceKey !== nextState.sourceKey
      },
    ])

    system.rotateCornerFromUser('0,0')
    system.processUpdates(1)

    expect(system.getState('0,0')?.isOn).toBe(true)
    expect(system.getState('1,0')?.isOn).toBe(true)
  })

  it('turns A on when it touches a B that is off', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 0 },
      { cellKey: '1,0', corner: 2 },
    ], [updatePowerStateFromNeighbors])

    system.rotateCornerFromUser('0,0')
    system.processUpdates(1)

    expect(system.getState('0,0')?.corner).toBe(1)
    expect(system.getState('0,0')?.isOn).toBe(true)
    expect(system.getMarkers().find((marker) => marker.cellKey === '0,0')?.sourceKey).toBe('1,0')
    expect(system.getState('1,0')?.isOn).toBe(false)
    expect(system.getMarkers().find((marker) => marker.cellKey === '1,0')?.sourceKey).toBeNull()
  })

  it('turns a corner on when it touches the same type that is on', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 0 },
      { cellKey: '1,0', corner: 1 },
    ], [updatePowerStateFromNeighbors])
    system.setCornerStateFromUpdate('1,0', { corner: 1, isOn: true, sourceKey: '1,-1' })

    system.rotateCornerFromUser('0,0')

    expect(system.getState('0,0')?.corner).toBe(1)
    expect(system.getState('0,0')?.isOn).toBe(true)
    expect(system.getMarkers().find((marker) => marker.cellKey === '0,0')?.sourceKey).toBe('1,0')
  })

  it('does not update a neighbor when removing a corner', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ])

    system.removeCornerFromUser('0,0')
    system.processUpdates(1)

    expect(system.getState('0,0')).toBeUndefined()
    expect(system.getState('1,0')?.corner).toBe(1)
  })

  it('reuses frozen snapshots on reads without exposing writes or changing older snapshots', () => {
    const system = new SandboxCellSystem([{ cellKey: '0,0', corner: 1 }])
    const initialState = system.getState('0,0')!
    expect(Object.isFrozen(initialState)).toBe(true)
    expect(system.getState('0,0')).toBe(initialState)
    expect(Reflect.set(initialState, 'isOn', true)).toBe(false)

    const nextState = { corner: 2, isOn: true, sourceKey: '1,0' }
    system.setCornerStateFromUpdate('0,0', nextState)
    nextState.isOn = false

    expect(initialState).toEqual({ corner: 1, isOn: false, sourceKey: null })
    expect(system.getState('0,0')).toEqual({ corner: 2, isOn: true, sourceKey: '1,0' })
    expect(Object.isFrozen(system.getState('0,0'))).toBe(true)
  })

  it('propagates true replies back to the sender even without state changes', () => {
    const calls: string[] = []
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ], [(_system, key) => {
      calls.push(key)
      return calls.length < 3
    }])

    system.rotateCornerFromUser('0,0')
    expect(system.processUpdates(20)).toBe(2)
    expect(calls).toEqual(['0,0', '1,0', '0,0'])
    expect(system.hasPendingUpdates()).toBe(false)
  })

  it('defers new broadcasts and replies to the next tick', () => {
    const calls: string[] = []
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
      { cellKey: '2,0', corner: 1 },
    ], [(_target, key) => { calls.push(key); return true }])

    system.rotateCornerFromUser('0,0')
    expect(system.processTick()).toBe(1)
    expect(calls).toEqual(['0,0', '1,0'])
    expect(system.processTick()).toBe(2)
    expect(calls).toEqual(['0,0', '1,0', '2,0', '0,0'])
    expect(system.processTick()).toBe(2)
    expect(calls.slice(-2)).toEqual(['1,0', '1,0'])
  })

  it('carries unprocessed tick work forward when the update budget is reached', () => {
    const calls: string[] = []
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '0,-1', corner: 1 },
      { cellKey: '1,0', corner: 1 },
      { cellKey: '0,1', corner: 1 },
      { cellKey: '-1,0', corner: 1 },
    ], [(_target, key) => { calls.push(key); return key === '0,0' }])

    system.rotateCornerFromUser('0,0')
    expect(system.processTick(4, 0)).toBe(0)
    expect(system.processTick(2)).toBe(2)
    expect(calls).toEqual(['0,0', '0,-1', '1,0'])
    expect(system.processTick(2)).toBe(2)
    expect(calls.slice(-2)).toEqual(['0,1', '-1,0'])
    expect(system.processTick()).toBe(0)
    expect(system.hasPendingUpdates()).toBe(false)
  })

  it('does not broadcast when a handler writes state but returns false', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 1 },
      { cellKey: '1,0', corner: 1 },
    ], [(target, key, state) => {
      target.setCornerStateFromUpdate(key, { ...state, isOn: true })
      return false
    }])

    system.rotateCornerFromUser('0,0')
    expect(system.getState('0,0')?.isOn).toBe(true)
    expect(system.processUpdates(20)).toBe(0)
    expect(system.getState('1,0')?.isOn).toBe(false)
  })

  it('runs every handler with the latest state and an immutable previous state', () => {
    const seenStates: unknown[] = []
    const system = new SandboxCellSystem([{ cellKey: '0,0', corner: 1 }], [
      (target, key, state) => {
        target.setCornerStateFromUpdate(key, { ...state, isOn: true, sourceKey: '0,-1' })
        return true
      },
      (_target, _key, state, previousState) => {
        expect(Object.isFrozen(state)).toBe(true)
        expect(Object.isFrozen(previousState)).toBe(true)
        seenStates.push(state, previousState)
        return false
      },
    ])

    system.rotateCornerFromUser('0,0')
    expect(seenStates).toEqual([
      { corner: 2, isOn: true, sourceKey: '0,-1' },
      { corner: 1, isOn: false, sourceKey: null },
    ])
  })

  it('preserves FIFO order and duplicate notifications when the queue grows and wraps', () => {
    const neighbors = new Map([
      ['0,0', ['0,-1', '1,0', '0,1', '-1,0']],
      ['0,-1', ['0,0']], ['1,0', ['0,0']], ['0,1', ['0,0']], ['-1,0', ['0,0']],
    ])
    const expected: string[] = []
    const referenceQueue = ['0,0']
    while (referenceQueue.length > 0) {
      const key = referenceQueue.shift()!
      expected.push(key)
      if (expected.length <= 2000) referenceQueue.push(...neighbors.get(key)!)
    }

    const actual: string[] = []
    const system = new SandboxCellSystem([...neighbors.keys()].map((cellKey) => ({ cellKey, corner: 1 })), [
      (_target, key) => {
        actual.push(key)
        return actual.length <= 2000
      },
    ])
    system.rotateCornerFromUser('0,0')
    let processed = 0
    while (system.hasPendingUpdates() && processed < expected.length) {
      processed += system.processUpdates(17)
    }

    expect(actual).toEqual(expected)
    expect(processed).toBe(expected.length - 1)
    expect(system.hasPendingUpdates()).toBe(false)
    system.rotateCornerFromUser('0,0')
    expect(system.processUpdates(17)).toBe(0)
  })

  it('skips removed queued cells and discovers neighbors inserted after the cache was built', () => {
    const calls: string[] = []
    const system = new SandboxCellSystem([
      { cellKey: '-2,-3', corner: 1 },
      { cellKey: '-1,-3', corner: 1 },
    ], [(_target, key) => { calls.push(key); return key === '-2,-3' }])

    system.rotateCornerFromUser('-2,-3')
    system.removeCornerFromUser('-1,-3')
    system.processUpdates(10)
    expect(calls).toEqual(['-2,-3', '-2,-3'])

    system.rotateCornerFromUser('-1,-3')
    calls.length = 0
    system.rotateCornerFromUser('-2,-3')
    expect(system.processUpdates(10)).toBe(1)
    expect(calls).toEqual(['-2,-3', '-1,-3'])
  })

  it('keeps last-matching-source priority and excludes neighbors powered by this cell', () => {
    const system = new SandboxCellSystem([
      { cellKey: '0,0', corner: 0 },
      { cellKey: '0,-1', corner: 2 },
      { cellKey: '1,0', corner: 2 },
      { cellKey: '0,1', corner: 2 },
      { cellKey: '-1,0', corner: 1, isOn: true, sourceKey: '0,0' },
    ], [updatePowerStateFromNeighbors])

    system.rotateCornerFromUser('0,0')
    expect(system.getState('0,0')).toEqual({ corner: 1, isOn: true, sourceKey: '0,1' })
    system.setCornerStateFromUpdate('-1,0', { corner: 2, isOn: false, sourceKey: null })
    system.rotateCornerFromUser('0,0')
    system.rotateCornerFromUser('0,0')
    system.rotateCornerFromUser('0,0')
    system.rotateCornerFromUser('0,0')
    expect(system.getState('0,0')?.sourceKey).toBe('-1,0')
  })
})
