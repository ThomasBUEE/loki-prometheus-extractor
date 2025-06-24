# Guide de Maintenance

Ce document décrit les tâches de maintenance pour le projet Loki-Prometheus Extractor.

## Vérifications de Qualité du Code

### 1. Vérification TypeScript
```bash
npm run typecheck
```
Cette commande vérifie tous les types et détecte les erreurs de compilation sans générer de fichiers.

### 2. Compilation
```bash
npm run build
```
Compile le code TypeScript vers JavaScript dans le dossier `dist/`.

### 3. Tests de Base
```bash
# Test de l'aide CLI
node dist/index.js --help

# Test de validation de configuration
node dist/index.js -c config/example-config.json --from "now-5m" --to "now"
```

## Structure du Code

### Architecture
- **`src/constants/`** : Constantes de l'application
- **`src/types/`** : Définitions de types TypeScript
- **`src/clients/`** : Clients API pour Loki et Thanos
- **`src/services/`** : Services métier (extraction de champs, filtrage)
- **`src/aggregators/`** : Logique d'agrégation des données
- **`src/writers/`** : Writers de sortie (CSV)
- **`src/utils/`** : Utilitaires (dates, JSON, erreurs)

### Principes de Code
- **DRY (Don't Repeat Yourself)** : Code commun centralisé dans `utils/`
- **Type Safety** : Types stricts avec TypeScript
- **Error Handling** : Classes d'erreurs personnalisées dans `utils/errors.ts`
- **Constants** : Toutes les constantes dans `constants/app.constants.ts`

## Fonctionnalités Implémentées

### ✅ Extraction de Données
- Support Loki (logs) et Thanos/Prometheus (métriques)
- Extraction de champs JSON depuis les logs Loki
- Formatage et transformation de données

### ✅ Agrégation
- Groupement par champs multiples
- Fonctions d'agrégation : sum, avg, min, max, count, percentile, first, last
- Agrégation par métrique individuelle

### ✅ Filtrage
- Filtres flexibles sur les données
- Types : regex, exact, contains, startsWith, endsWith
- Modes : include/exclude
- Support de la casse

### ✅ Sortie
- Export CSV avec colonnes configurables
- Formatage de dates personnalisable
- Nommage de fichiers avec variables

### ✅ Ligne de Commande
- Configuration via fichier JSON
- Override des plages de temps via CLI
- Gestion d'erreurs robuste

## Ajout de Nouvelles Fonctionnalités

### 1. Nouvelle Fonction d'Agrégation
1. Ajouter la fonction à `AGGREGATION_FUNCTIONS` dans `constants/app.constants.ts`
2. Implémenter la logique dans `aggregators/data-aggregator.ts` méthode `applyFunction`
3. Mettre à jour la documentation

### 2. Nouveau Type de Filtre
1. Ajouter le type à `FILTER_TYPES` dans `constants/app.constants.ts`
2. Implémenter la logique dans `services/data-filter.service.ts` méthode `matchesFilter`
3. Ajouter des exemples dans la configuration

### 3. Nouveau Format de Sortie
1. Créer un nouveau writer dans `writers/`
2. Ajouter le format au schema de validation dans `index.ts`
3. Intégrer dans la fonction `main()`

## Maintenance des Dépendances

### Mise à Jour des Packages
```bash
# Vérifier les packages obsolètes
npm outdated

# Mettre à jour (attention aux breaking changes)
npm update

# Mettre à jour les types
npm update @types/node
```

### Audit de Sécurité
```bash
npm audit
npm audit fix
```

## Débogage

### Variables d'Environnement
- `DEBUG=1` : Active les logs de débogage détaillés
- `FAIL_ON_ERROR=true` : Arrête le traitement sur la première erreur

### Logs de Débogage
Les logs de débogage sont présents dans :
- `writers/csv-writer.ts` : Extraction de valeurs
- `aggregators/data-aggregator.ts` : Résultats d'agrégation

### Erreurs Communes
1. **Types manquants** : Vérifier avec `npm run typecheck`
2. **Configuration invalide** : Valider avec le schema Joi
3. **API inaccessibles** : Vérifier les URLs et timeouts

## Performance

### Optimisations Actuelles
- Agrégation en mémoire pour de gros volumes
- Extraction de champs optimisée
- Parsing JSON sécurisé avec fallback

### Limites
- Limite par défaut Loki : 5000 entrées (`DEFAULT_LOKI_LIMIT`)
- Timeout par défaut : 30 secondes
- Traitement en mémoire (pas de streaming)

## Tests

### Tests Manuels Recommandés
1. Configuration simple Loki
2. Configuration simple Thanos
3. Extraction de champs JSON
4. Agrégation multi-métriques
5. Filtrage de données
6. Override de plages temporelles CLI

### Configuration de Test
Utiliser `config/example-config.json` qui contient tous les exemples de fonctionnalités.

## Bonnes Pratiques

### Code
- Toujours typer les fonctions publiques
- Utiliser les constantes plutôt que des magic numbers
- Gérer les erreurs avec les classes personnalisées
- Documenter les fonctions complexes

### Configuration
- Valider toute nouvelle configuration avec Joi
- Fournir des exemples pour chaque fonctionnalité
- Documenter les formats acceptés

### Maintenance
- Tester après chaque changement majeur
- Maintenir la documentation à jour
- Versionner les breaking changes
