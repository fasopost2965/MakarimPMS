import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private isMock = false;
  private memoryStore: Record<string, any[]> = {};

  constructor() {
    super();
    // Use a Proxy to dynamically intercept all model database calls when in mock mode
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (
          typeof prop === 'string' &&
          target.isMock &&
          ![
            'onModuleInit',
            'onModuleDestroy',
            '$connect',
            '$disconnect',
            '$transaction',
            'isMock',
            'memoryStore',
            'getMockModel',
            'seedMockData',
          ].includes(prop)
        ) {
          return target.getMockModel(prop);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    try {
      console.log('[AI Studio] Connecting to database...');
      await this.$connect();
      console.log('[AI Studio] Database connected successfully!');
    } catch (err) {
      console.warn(
        '[AI Studio] Database connection failed. Activating in-memory mock for PrismaClient.',
      );
      this.isMock = true;
      await this.seedMockData();
    }
  }

  async onModuleDestroy() {
    if (!this.isMock) {
      await this.$disconnect();
    }
  }

  async $transaction(cb: any) {
    if (this.isMock) {
      if (typeof cb === 'function') {
        return await cb(this);
      }
      if (Array.isArray(cb)) {
        const results: any[] = [];
        for (const promise of cb) {
          results.push(await promise);
        }
        return results;
      }
      return cb;
    }
    return super.$transaction(cb);
  }

  private async seedMockData() {
    console.log('[AI Studio] Seeding in-memory database mock...');

    // 1. Roles
    const roles = [
      { id: 1, nom: 'Administrateur' },
      { id: 2, nom: 'Réception' },
      { id: 3, nom: 'Gouvernante' },
      { id: 4, nom: 'Comptable' },
      { id: 5, nom: 'Maintenance' },
      { id: 6, nom: 'RH' },
    ];
    this.memoryStore['role'] = roles;

    // 2. Permissions
    const modules = [
      'reservations',
      'checkin',
      'housekeeping',
      'billing',
      'dashboard',
      'maintenance',
      'guests',
      'audit',
      'parameters',
    ] as const;
    const actions = ['read', 'write', 'delete', 'export'] as const;
    const permissions: any[] = [];
    let permId = 1;
    for (const m of modules) {
      for (const a of actions) {
        permissions.push({ id: permId++, module: m, action: a });
      }
    }
    permissions.push({ id: permId++, module: 'guests', action: 'blacklist' });
    this.memoryStore['permission'] = permissions;

    // 3. RolePermissions
    const rolePermissions: any[] = [];
    let rpId = 1;
    // Admin gets all
    for (const p of permissions) {
      rolePermissions.push({ id: rpId++, roleId: 1, permissionId: p.id });
    }
    // Reception permissions
    const receptionPermKeys = [
      'reservations:read',
      'reservations:write',
      'checkin:read',
      'checkin:write',
      'housekeeping:read',
      'housekeeping:write',
      'dashboard:read',
      'guests:read',
      'guests:write',
    ];
    for (const key of receptionPermKeys) {
      const [m, a] = key.split(':');
      const p = permissions.find(
        (perm) => perm.module === m && perm.action === a,
      );
      if (p)
        rolePermissions.push({ id: rpId++, roleId: 2, permissionId: p.id });
    }
    // Gouvernante permissions
    const gouvPermKeys = [
      'housekeeping:read',
      'housekeeping:write',
      'maintenance:read',
    ];
    for (const key of gouvPermKeys) {
      const [m, a] = key.split(':');
      const p = permissions.find(
        (perm) => perm.module === m && perm.action === a,
      );
      if (p)
        rolePermissions.push({ id: rpId++, roleId: 3, permissionId: p.id });
    }
    // Comptable
    const comptablePermKeys = [
      'billing:read',
      'billing:write',
      'dashboard:read',
      'guests:read',
    ];
    for (const key of comptablePermKeys) {
      const [m, a] = key.split(':');
      const p = permissions.find(
        (perm) => perm.module === m && perm.action === a,
      );
      if (p)
        rolePermissions.push({ id: rpId++, roleId: 4, permissionId: p.id });
    }
    // Maintenance
    const maintPermKeys = ['maintenance:read', 'maintenance:write'];
    for (const key of maintPermKeys) {
      const [m, a] = key.split(':');
      const p = permissions.find(
        (perm) => perm.module === m && perm.action === a,
      );
      if (p)
        rolePermissions.push({ id: rpId++, roleId: 5, permissionId: p.id });
    }
    this.memoryStore['rolePermission'] = rolePermissions;

    // 4. Users
    const motDePasseHash = await bcrypt.hash('Password123!', 10);
    const users = [
      {
        id: 1,
        nom: 'Admin Test',
        email: 'admin@makarim.test',
        motDePasseHash,
        roleId: 1,
        actif: true,
      },
      {
        id: 2,
        nom: 'Réception Test',
        email: 'reception@makarim.test',
        motDePasseHash,
        roleId: 2,
        actif: true,
      },
      {
        id: 3,
        nom: 'Gouvernante Test',
        email: 'gouvernante@makarim.test',
        motDePasseHash,
        roleId: 3,
        actif: true,
      },
      {
        id: 4,
        nom: 'Comptable Test',
        email: 'comptable@makarim.test',
        motDePasseHash,
        roleId: 4,
        actif: true,
      },
      {
        id: 5,
        nom: 'Maintenance Test',
        email: 'maintenance@makarim.test',
        motDePasseHash,
        roleId: 5,
        actif: true,
      },
      {
        id: 6,
        nom: 'RH Test',
        email: 'rh@makarim.test',
        motDePasseHash,
        roleId: 6,
        actif: true,
      },
    ];
    this.memoryStore['user'] = users;

    // 5. RoomTypes
    const roomTypes = [
      { id: 1, nom: 'Single', prixBase: 400, capacite: 1 },
      { id: 2, nom: 'Double', prixBase: 500, capacite: 2 },
      { id: 3, nom: 'Triple', prixBase: 750, capacite: 3 },
      { id: 4, nom: 'Suite', prixBase: 650, capacite: 2 },
      { id: 5, nom: 'Quadruple', prixBase: 900, capacite: 4 },
    ];
    this.memoryStore['roomType'] = roomTypes;

    // 6. Rooms
    const rooms: any[] = [];
    const roomPlan = [
      { typeId: 1, prefix: 100, count: 6 },
      { typeId: 2, prefix: 200, count: 8 },
      { typeId: 3, prefix: 300, count: 4 },
      { typeId: 4, prefix: 400, count: 4 },
      { typeId: 5, prefix: 500, count: 2 },
    ];
    let roomId = 1;
    for (const { typeId, prefix, count } of roomPlan) {
      for (let i = 1; i <= count; i++) {
        rooms.push({
          id: roomId++,
          numero: `${prefix + i}`,
          roomTypeId: typeId,
          statut: 'LIBRE_PROPRE',
          deletedAt: null,
        });
      }
    }
    this.memoryStore['room'] = rooms;

    // 7. Hotel Config
    this.memoryStore['hotelConfig'] = [
      {
        id: 1,
        raisonSociale: 'Hôtel Makarim SARL',
        ice: '000000000000000',
        identifiantFiscal: '00000000',
        rc: '00000',
        adresse: 'Tétouan, Maroc',
        categorieEtoiles: 3,
      },
    ];

    // 8. Tax Rate configs
    this.memoryStore['taxRateConfig'] = [
      { id: 1, type: 'TVA_HEBERGEMENT', taux: 10 },
      { id: 2, type: 'TVA_ANNEXE', taux: 20 },
      { id: 3, type: 'TAXE_SEJOUR', taux: 2 },
    ];

    // 9. Season rates
    this.memoryStore['seasonRate'] = [
      {
        id: 1,
        libelle: 'Haute saison 1',
        dateDebut: new Date('2026-07-01'),
        dateFin: new Date('2026-07-19'),
        prixNuit: 600,
        roomTypeId: 1,
      },
      {
        id: 2,
        libelle: 'Haute saison 1',
        dateDebut: new Date('2026-07-01'),
        dateFin: new Date('2026-07-19'),
        prixNuit: 750,
        roomTypeId: 2,
      },
      {
        id: 3,
        libelle: 'Haute saison 1',
        dateDebut: new Date('2026-07-01'),
        dateFin: new Date('2026-07-19'),
        prixNuit: 900,
        roomTypeId: 3,
      },
      {
        id: 4,
        libelle: 'Haute saison 1',
        dateDebut: new Date('2026-07-01'),
        dateFin: new Date('2026-07-19'),
        prixNuit: 800,
        roomTypeId: 4,
      },
      {
        id: 5,
        libelle: 'Haute saison 1',
        dateDebut: new Date('2026-07-01'),
        dateFin: new Date('2026-07-19'),
        prixNuit: 1100,
        roomTypeId: 5,
      },
      {
        id: 6,
        libelle: 'Haute saison 2',
        dateDebut: new Date('2026-07-20'),
        dateFin: new Date('2026-08-31'),
        prixNuit: 700,
        roomTypeId: 1,
      },
      {
        id: 7,
        libelle: 'Haute saison 2',
        dateDebut: new Date('2026-07-20'),
        dateFin: new Date('2026-08-31'),
        prixNuit: 850,
        roomTypeId: 2,
      },
      {
        id: 8,
        libelle: 'Haute saison 2',
        dateDebut: new Date('2026-07-20'),
        dateFin: new Date('2026-08-31'),
        prixNuit: 1000,
        roomTypeId: 3,
      },
      {
        id: 9,
        libelle: 'Haute saison 2',
        dateDebut: new Date('2026-07-20'),
        dateFin: new Date('2026-08-31'),
        prixNuit: 900,
        roomTypeId: 4,
      },
      {
        id: 10,
        libelle: 'Haute saison 2',
        dateDebut: new Date('2026-07-20'),
        dateFin: new Date('2026-08-31'),
        prixNuit: 1200,
        roomTypeId: 5,
      },
    ];

    // 10. Sample Guests
    this.memoryStore['guest'] = [
      {
        id: 1,
        nom: 'El Amrani',
        prenom: 'Youssef',
        email: 'youssef@email.com',
        telephone: '+212600000001',
        pieceIdentite: 'K123456',
        nationalite: 'Marocain',
        categorie: 'STANDARD',
        actif: true,
        blacklist: false,
      },
      {
        id: 2,
        nom: 'Dupont',
        prenom: 'Jean',
        email: 'jean.dupont@email.com',
        telephone: '+33611223344',
        pieceIdentite: 'FR98765',
        nationalite: 'Français',
        categorie: 'VIP',
        actif: true,
        blacklist: false,
      },
    ];

    // 11. Sample Reservations
    const today = new Date();
    const in3Days = new Date();
    in3Days.setDate(today.getDate() + 3);
    this.memoryStore['reservation'] = [
      {
        id: 1,
        canal: 'DIRECT',
        guestId: 1,
        roomId: 1, // Room 101
        dateArrivee: today,
        dateDepart: in3Days,
        statut: 'CONFIRMEE',
        prixTotalCalcule: 1200,
        prixTotalFinal: 1200,
        createdAt: today,
        updatedAt: today,
        deletedAt: null,
      },
    ];

    console.log('[AI Studio] In-memory database mock seeded successfully!');
  }

  private getMockModel(modelName: string) {
    if (!this.memoryStore[modelName]) {
      this.memoryStore[modelName] = [];
    }
    const store = this.memoryStore[modelName];
    const allStores = this.memoryStore;

    const matchWhere = (item: any, where: any): boolean => {
      if (!where) return true;
      for (const [key, val] of Object.entries(where)) {
        if (val && typeof val === 'object' && 'some' in (val as any)) {
          const someVal = (val as any).some;
          let matches = false;
          if (modelName === 'role' && key === 'permissions') {
            const related = (allStores['rolePermission'] || []).filter(
              (rp: any) => rp.roleId === item.id,
            );
            matches = related.some((rp: any) => matchWhere(rp, someVal));
          } else if (modelName === 'permission' && key === 'roles') {
            const related = (allStores['rolePermission'] || []).filter(
              (rp: any) => rp.permissionId === item.id,
            );
            matches = related.some((rp: any) => matchWhere(rp, someVal));
          } else if (modelName === 'role' && key === 'users') {
            const related = (allStores['user'] || []).filter(
              (u: any) => u.roleId === item.id,
            );
            matches = related.some((u: any) => matchWhere(u, someVal));
          }
          if (!matches) return false;
          continue;
        }
        if (
          val &&
          typeof val === 'object' &&
          !Array.isArray(val) &&
          !(val instanceof Date)
        ) {
          const opKeys = Object.keys(val);
          for (const opKey of opKeys) {
            const opVal = val[opKey];
            if (opKey === 'equals') {
              if (item[key] !== opVal) return false;
            } else if (opKey === 'in') {
              if (!Array.isArray(opVal) || !opVal.includes(item[key]))
                return false;
            } else if (opKey === 'notIn') {
              if (Array.isArray(opVal) && opVal.includes(item[key]))
                return false;
            } else if (opKey === 'gte') {
              if (!(item[key] >= opVal)) return false;
            } else if (opKey === 'lte') {
              if (!(item[key] <= opVal)) return false;
            } else if (opKey === 'gt') {
              if (!(item[key] > opVal)) return false;
            } else if (opKey === 'lt') {
              if (!(item[key] < opVal)) return false;
            } else if (opKey === 'contains') {
              if (
                typeof item[key] !== 'string' ||
                !item[key].toLowerCase().includes(String(opVal).toLowerCase())
              )
                return false;
            } else {
              if (item[key] !== opVal) return false;
            }
          }
        } else {
          if (item[key] !== val) return false;
        }
      }
      return true;
    };

    const resolveIncludes = (item: any, include: any): any => {
      if (!include || !item) return item;
      const result = { ...item };
      for (const [key, value] of Object.entries(include)) {
        if (!value) continue;
        if (key === 'guest' && item.guestId !== undefined) {
          const related = (allStores['guest'] || []).find(
            (g) => g.id === item.guestId,
          );
          result.guest = resolveIncludes(
            related,
            value === true ? null : value,
          );
        } else if (key === 'room' && item.roomId !== undefined) {
          const related = (allStores['room'] || []).find(
            (r) => r.id === item.roomId,
          );
          result.room = resolveIncludes(related, value === true ? null : value);
        } else if (key === 'roomType' && item.roomTypeId !== undefined) {
          const related = (allStores['roomType'] || []).find(
            (rt) => rt.id === item.roomTypeId,
          );
          result.roomType = resolveIncludes(
            related,
            value === true ? null : value,
          );
        } else if (key === 'role' && item.roleId !== undefined) {
          const related = (allStores['role'] || []).find(
            (r) => r.id === item.roleId,
          );
          result.role = resolveIncludes(related, value === true ? null : value);
        } else if (key === 'company' && item.companyId !== undefined) {
          const related = (allStores['company'] || []).find(
            (c) => c.id === item.companyId,
          );
          result.company = resolveIncludes(
            related,
            value === true ? null : value,
          );
        } else if (key === 'reservations' && item.id !== undefined) {
          const related = (allStores['reservation'] || []).filter(
            (r) => r.roomId === item.id || r.guestId === item.id,
          );
          result.reservations = related.map((r) =>
            resolveIncludes(r, value === true ? null : value),
          );
        } else if (key === 'stays' && item.id !== undefined) {
          const related = (allStores['stay'] || []).filter(
            (s) => s.roomId === item.id,
          );
          result.stays = related.map((s) =>
            resolveIncludes(s, value === true ? null : value),
          );
        } else if (key === 'statusLogs' && item.id !== undefined) {
          const related = (allStores['roomStatusLog'] || []).filter(
            (l) => l.roomId === item.id,
          );
          result.statusLogs = related.map((l) =>
            resolveIncludes(l, value === true ? null : value),
          );
        } else if (key === 'maintenanceTickets' && item.id !== undefined) {
          const related = (allStores['maintenanceTicket'] || []).filter(
            (t) => t.roomId === item.id,
          );
          result.maintenanceTickets = related.map((t) =>
            resolveIncludes(t, value === true ? null : value),
          );
        }
      }
      return result;
    };

    return {
      findMany: async (args?: any) => {
        let items = [...store];
        if (args?.where) {
          items = items.filter((item) => matchWhere(item, args.where));
        }
        let mapped = items.map((item) => resolveIncludes(item, args?.include));
        // Simple skip / take pagination
        if (args?.skip !== undefined) {
          mapped = mapped.slice(args.skip);
        }
        if (args?.take !== undefined) {
          mapped = mapped.slice(0, args.take);
        }
        return mapped;
      },
      findFirst: async (args?: any) => {
        let items = [...store];
        if (args?.where) {
          items = items.filter((item) => matchWhere(item, args.where));
        }
        return items[0] ? resolveIncludes(items[0], args?.include) : null;
      },
      findUnique: async (args?: any) => {
        let items = [...store];
        if (args?.where) {
          items = items.filter((item) => matchWhere(item, args.where));
        }
        return items[0] ? resolveIncludes(items[0], args?.include) : null;
      },
      create: async (args: any) => {
        const id =
          store.length > 0 ? Math.max(...store.map((i) => i.id || 0)) + 1 : 1;
        const newItem = { id, ...args.data };
        store.push(newItem);
        return resolveIncludes(newItem, args.include);
      },
      update: async (args: any) => {
        const itemIndex = store.findIndex((item) =>
          matchWhere(item, args.where),
        );
        if (itemIndex === -1) {
          throw new Error(`Record not found in ${modelName} for update.`);
        }
        const updated = { ...store[itemIndex], ...args.data };
        store[itemIndex] = updated;
        return resolveIncludes(updated, args.include);
      },
      delete: async (args: any) => {
        const itemIndex = store.findIndex((item) =>
          matchWhere(item, args.where),
        );
        if (itemIndex === -1) {
          throw new Error(`Record not found in ${modelName} for delete.`);
        }
        const item = store[itemIndex];
        store.splice(itemIndex, 1);
        return resolveIncludes(item, args.include);
      },
      upsert: async (args: any) => {
        const itemIndex = store.findIndex((item) =>
          matchWhere(item, args.where),
        );
        if (itemIndex !== -1) {
          const updated = { ...store[itemIndex], ...args.update };
          store[itemIndex] = updated;
          return resolveIncludes(updated, args.include);
        } else {
          const id =
            store.length > 0 ? Math.max(...store.map((i) => i.id || 0)) + 1 : 1;
          const newItem = { id, ...args.create };
          store.push(newItem);
          return resolveIncludes(newItem, args.include);
        }
      },
      count: async (args?: any) => {
        let items = [...store];
        if (args?.where) {
          items = items.filter((item) => matchWhere(item, args.where));
        }
        return items.length;
      },
      aggregate: async (args?: any) => {
        let items = [...store];
        if (args?.where) {
          items = items.filter((item) => matchWhere(item, args.where));
        }
        const result: any = {};
        if (args?._sum) {
          result._sum = {};
          for (const key of Object.keys(args._sum)) {
            let sumVal = 0;
            for (const item of items) {
              if (item[key] !== undefined && item[key] !== null) {
                const val =
                  typeof item[key] === 'object' && item[key]?.toNumber
                    ? item[key].toNumber()
                    : Number(item[key]);
                if (!isNaN(val)) {
                  sumVal += val;
                }
              }
            }
            result._sum[key] = new Prisma.Decimal(sumVal);
          }
        }
        if (args?._avg) {
          result._avg = {};
          for (const key of Object.keys(args._avg)) {
            let sumVal = 0;
            let countVal = 0;
            for (const item of items) {
              if (item[key] !== undefined && item[key] !== null) {
                const val =
                  typeof item[key] === 'object' && item[key]?.toNumber
                    ? item[key].toNumber()
                    : Number(item[key]);
                if (!isNaN(val)) {
                  sumVal += val;
                  countVal++;
                }
              }
            }
            result._avg[key] =
              countVal > 0 ? new Prisma.Decimal(sumVal / countVal) : null;
          }
        }
        if (args?._min) {
          result._min = {};
          for (const key of Object.keys(args._min)) {
            const vals = items
              .map((item) => item[key])
              .filter((v) => v !== undefined && v !== null);
            result._min[key] =
              vals.length > 0
                ? vals[0] instanceof Date
                  ? new Date(Math.min(...vals.map((v) => v.getTime())))
                  : Math.min(...vals.map(Number))
                : null;
          }
        }
        if (args?._max) {
          result._max = {};
          for (const key of Object.keys(args._max)) {
            const vals = items
              .map((item) => item[key])
              .filter((v) => v !== undefined && v !== null);
            result._max[key] =
              vals.length > 0
                ? vals[0] instanceof Date
                  ? new Date(Math.max(...vals.map((v) => v.getTime())))
                  : Math.max(...vals.map(Number))
                : null;
          }
        }
        if (args?._count) {
          result._count = {};
          if (typeof args._count === 'boolean' && args._count) {
            result._count = items.length;
          } else {
            for (const key of Object.keys(args._count)) {
              const vals = items.filter(
                (item) => item[key] !== undefined && item[key] !== null,
              );
              result._count[key] = vals.length;
            }
          }
        }
        return result;
      },
      deleteMany: async (args?: any) => {
        await Promise.resolve();
        if (args?.where) {
          let count = 0;
          for (let i = store.length - 1; i >= 0; i--) {
            if (matchWhere(store[i], args.where)) {
              store.splice(i, 1);
              count++;
            }
          }
          return { count };
        }
        const count = store.length;
        store.length = 0;
        return { count };
      },
      createMany: async (args: any) => {
        await Promise.resolve();
        const dataArr = Array.isArray(args.data) ? args.data : [args.data];
        let nextId =
          store.length > 0 ? Math.max(...store.map((i) => i.id || 0)) + 1 : 1;
        for (const record of dataArr) {
          const newItem = { id: nextId++, ...record };
          store.push(newItem);
        }
        return { count: dataArr.length };
      },
      updateMany: async (args: any) => {
        await Promise.resolve();
        let count = 0;
        for (let i = 0; i < store.length; i++) {
          if (matchWhere(store[i], args.where)) {
            store[i] = { ...store[i], ...args.data };
            count++;
          }
        }
        return { count };
      },
    };
  }
}
