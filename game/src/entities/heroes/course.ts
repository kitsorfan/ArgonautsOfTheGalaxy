/**
 * A small practice course for trying the heroes out in a desktop browser: `#deck=plains&course`
 * (add `&heroes=jason,atalanta` to switch, `&hero=atalanta` to start as her). It is never part of
 * the game's level list. From the bottom up: a sprint jump over a gap, a wall-run along the striped
 * left wall over a chasm, a low gap to slide under, an arrow target on an island that opens the
 * door, and a few sporelings to try the bow and the kick on.
 */
import type { Track } from '../../core/music';
import type { DeckId, LevelDef } from '../../world/levelTypes';

const MAP = `
########################
#..........C...........#
#......................#
#....e.........e.......#
#......................#
#..........e...........#
#......................#
###########D############
#......................#
#..............        #
#..............   T    #
#..............        #
#......................#
###########L############
W......................#
W.....h................#
W......................#
W                      #
W                      #
W                      #
W                      #
W                      #
W                      #
W                      #
W......................#
W..........=...........#
W......................#
#......................#
#                      #
#                      #
#                      #
#......................#
#......................#
#......................#
#.....o.o.o.o..........#
#......................#
#...........@..........#
#......................#
########################
`;

/** The course, dressed as deck `id` (its theme) with that deck's music; nothing in it needs new text. */
export function heroCourse(id: DeckId, name: string, music: Track): LevelDef {
  return {
    id,
    index: 13,
    name,
    subtitle: '',
    music,
    map: MAP,
    legend: {
      C: { type: 'checkpoint', id: 'goal' },
      D: { type: 'door', id: 'gate', open: { flag: 'gate' } },
      T: { type: 'target', flag: 'gate' },
      L: { type: 'lowgap' },
      W: { type: 'wallrun' },
      e: { type: 'enemy', enemy: 'sporeling' },
    },
    objectives: [],
    shardIds: [],
    dialogues: {},
    heroes: ['atalanta', 'jason'],
  };
}
