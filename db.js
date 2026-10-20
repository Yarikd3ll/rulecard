class DB {
  constructor() {
    this.dbName = 'RuleCardDB';
    this.version = 1;
    this.db = null;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('sections')) {
          const s = db.createObjectStore('sections', { keyPath: 'id', autoIncrement: true });
          s.createIndex('subjectId', 'subjectId');
        }
        if (!db.objectStoreNames.contains('cards')) {
          const c = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
          c.createIndex('sectionId', 'sectionId');
          c.createIndex('nextReview', 'nextReview');
        }
      };

      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  _tx(store, mode = 'readonly') {
    return this.db.transaction(store, mode).objectStore(store);
  }

  getAll(store) {
    return new Promise((res, rej) => {
      const r = this._tx(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  getById(store, id) {
    return new Promise((res, rej) => {
      const r = this._tx(store).get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  getByIndex(store, index, value) {
    return new Promise((res, rej) => {
      const r = this._tx(store).index(index).getAll(value);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  add(store, data) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readwrite').add(data);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  put(store, data) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readwrite').put(data);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  delete(store, id) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readwrite').delete(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async deleteByIndex(store, index, value) {
    const items = await this.getByIndex(store, index, value);
    for (const item of items) await this.delete(store, item.id);
  }
}

const db = new DB();
