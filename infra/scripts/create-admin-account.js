/*
 * Création ponctuelle d'un compte utilisateur (ÉTAPE 0 : Administrateur ; recette : Gouvernante, Réception…).
 *
 * Usage (depuis le dépôt, sur le VPS ou en local avec docker compose) :
 *   cat infra/scripts/create-admin-account.js | \
 *     docker compose -f docker-compose.yml -f docker-compose.prod.yml \
 *       exec -T -e ADMIN_EMAIL=moi@exemple.com -e ADMIN_NOM="Prénom Nom" \
 *       -e ADMIN_ROLE=Gouvernante   (optionnel, défaut : Administrateur) \
 *       backend node -
 *
 * Règles :
 *  - Même hachage que l'application (bcrypt, 10 tours, cf. AuthService).
 *  - Rôle existant (ADMIN_ROLE, défaut « Administrateur »), jamais créé ici.
 *  - Refuse d'écraser un compte existant (email déjà pris).
 *  - Le mot de passe est généré ici, affiché UNE SEULE FOIS sur la sortie
 *    standard, jamais écrit sur disque, dans le dépôt ni dans un journal.
 *  - Aucune écriture SQL brute : uniquement le client Prisma de l'application.
 *  - Pas de ligne AuditLog : l'enum AuditEntity ne contient pas encore
 *    d'entité User (sera ajoutée avec le « socle comptes », lot 1). La trace
 *    est la ligne du journal des interventions.
 */
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const BCRYPT_SALT_ROUNDS = 10;

function genererMotDePasse() {
  const minuscules = 'abcdefghijkmnopqrstuvwxyz';
  const majuscules = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const chiffres = '23456789';
  const symboles = '!@#%*+-=?';
  const tout = minuscules + majuscules + chiffres + symboles;
  const pick = (alphabet) => alphabet[crypto.randomInt(alphabet.length)];
  const chars = [
    pick(minuscules),
    pick(majuscules),
    pick(chiffres),
    pick(symboles),
  ];
  while (chars.length < 20) chars.push(pick(tout));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const nom = (process.env.ADMIN_NOM || 'Administrateur').trim();
  const nomRole = (process.env.ADMIN_ROLE || 'Administrateur').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL manquant ou invalide.');
  }

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({
      where: { nom: nomRole },
    });
    if (!role) throw new Error(`Rôle « ${nomRole} » introuvable.`);

    const existant = await prisma.user.findUnique({ where: { email } });
    if (existant) {
      throw new Error(
        `Un compte existe déjà pour ${email} (id ${existant.id}). Rien n'a été modifié.`,
      );
    }

    const motDePasse = genererMotDePasse();
    const motDePasseHash = await bcrypt.hash(motDePasse, BCRYPT_SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { nom, email, motDePasseHash, roleId: role.id, actif: true },
    });

    console.log('');
    console.log(`Compte ${role.nom} créé.`);
    console.log(`  id        : ${user.id}`);
    console.log(`  email     : ${email}`);
    console.log(`  rôle      : ${role.nom}`);
    console.log(`  mot de passe (affiché une seule fois) : ${motDePasse}`);
    console.log('');
    console.log('Note-le maintenant dans ton gestionnaire de mots de passe.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`ÉCHEC : ${err.message}`);
  process.exit(1);
});
