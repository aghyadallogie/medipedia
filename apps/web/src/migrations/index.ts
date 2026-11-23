import * as migration_20261122_115141_initial from './20261122_115141_initial';
import * as migration_20261122_191614_phase2_content_model from './20261122_191614_phase2_content_model';
import * as migration_20261123_013814_phase4_learner_auth from './20261123_013814_phase4_learner_auth';

export const migrations = [
  {
    up: migration_20261122_115141_initial.up,
    down: migration_20261122_115141_initial.down,
    name: '20261122_115141_initial',
  },
  {
    up: migration_20261122_191614_phase2_content_model.up,
    down: migration_20261122_191614_phase2_content_model.down,
    name: '20261122_191614_phase2_content_model',
  },
  {
    up: migration_20261123_013814_phase4_learner_auth.up,
    down: migration_20261123_013814_phase4_learner_auth.down,
    name: '20261123_013814_phase4_learner_auth'
  },
];
