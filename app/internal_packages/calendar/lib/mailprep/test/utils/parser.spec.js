import sinon from 'sinon'; // test lib
import util from 'util'; // circular lib checking

import * as dav from 'dav'; // caldav library
// import { rewire } from 'rewire';

// import rewire from 'rewire';
import * as PARSER from '../../app/utils/parser';
import { mockEventData, mockRecurrData } from '../reducers/mockEventData';
import {
  mockRecurrExpandedResults,
  mockRecurrPatternData
} from '../reducers/mockRecurrExpandedData';

// import * as testInput from '../testinput/Daily, 7 Times, 1 Deleted.json';
// import * as testOutput from '../testoutput/Daily, 7 Times, 1 Deleted.json';

import * as recurExpandFixturesTable from '../index';

// const parser = _parser;
// const Parser = rewire('../../app/utils/parser');
describe('CalDav Utils Functions', () => {
  let sandbox = null;
  // let tempParser;
  // try {
  //   tempParser = rewire('../../app/utils/parser');
  // } catch (e) {
  //   console.log(e);
  // }
  // tempParser.__set__('parser', parser);

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Parse Recurrence Events', () => {
    it('Empty Array', () => {
      // Parser.__set__();
      // parser = new Parser();
      const result = PARSER.parseRecurrenceEvents([]);
      expect(result).toEqual([]);
    });

    it('Single Events only', () => {
      const input = [
        { eventData: mockEventData[0] },
        { eventData: mockEventData[1] },
        { eventData: mockEventData[2] }
      ];

      const result = PARSER.parseRecurrenceEvents(input);
      result.forEach((event) => delete event.id);
    });

    it('One Recurring Event only', () => {
      const input = [{ eventData: mockEventData[0], recurData: mockRecurrData[0] }];
      const expectedResult = [mockRecurrPatternData[0]];

      const result = PARSER.parseRecurrenceEvents(input);

      result.forEach((event) => delete event.id);
      expectedResult.forEach((event) => delete event.id);
      expect(result).toEqual(expectedResult);
    });

    it('Multiple Recurring Event only', () => {
      const input = [
        { eventData: mockEventData[0], recurData: mockRecurrData[0] },
        { eventData: mockEventData[1], recurData: mockRecurrData[1] }
      ];
      const expectedResult = [mockRecurrPatternData[0], mockRecurrPatternData[1]];

      const result = PARSER.parseRecurrenceEvents(input);

      result.forEach((event) => delete event.id);
      expectedResult.forEach((event) => delete event.id);
      expect(result).toEqual(expectedResult);
    });

    it('One Recurring Event and One Single Event', () => {
      const input = [
        { eventData: mockEventData[0], recurData: mockRecurrData[0] },
        { eventData: mockEventData[1] }
      ];
      const expectedResult = [mockRecurrPatternData[0]];

      const result = PARSER.parseRecurrenceEvents(input);

      result.forEach((event) => delete event.id);
      expectedResult.forEach((event) => delete event.id);
      expect(result).toEqual(expectedResult);
    });

    it('Multiple Recurring Event and One Single Event', () => {
      const input = [
        { eventData: mockEventData[0], recurData: mockRecurrData[0] },
        { eventData: mockEventData[1], recurData: mockRecurrData[1] },
        { eventData: mockEventData[2] }
      ];
      const expectedResult = [mockRecurrPatternData[0], mockRecurrPatternData[1]];

      const result = PARSER.parseRecurrenceEvents(input);

      result.forEach((event) => delete event.id);
      expectedResult.forEach((event) => delete event.id);
      expect(result).toEqual(expectedResult);
    });

    it('Multiple Recurring Event and Multiple Single Event', () => {
      const input = [
        { eventData: mockEventData[0], recurData: mockRecurrData[0] },
        { eventData: mockEventData[1], recurData: mockRecurrData[1] },
        { eventData: mockEventData[2] },
        { eventData: mockEventData[3] }
      ];
      const expectedResult = [mockRecurrPatternData[0], mockRecurrPatternData[1]];

      const result = PARSER.parseRecurrenceEvents(input);

      result.forEach((event) => delete event.id);
      expectedResult.forEach((event) => delete event.id);
      expect(result).toEqual(expectedResult);
    });

    it('RecurData null or undefined', () => {
      const input = [
        { eventData: mockEventData[0], recurData: null },
        { eventData: mockEventData[0], recurData: undefined },
        { eventData: mockEventData[3] }
      ];
      const expectedResult = [];

      const result = PARSER.parseRecurrenceEvents(input);

      result.forEach((event) => delete event.id);
      expectedResult.forEach((event) => delete event.id);
      expect(result).toEqual(expectedResult);
    });
  });

  // describe('Converting iCal Weekly Pattern', () => {
  //   it('')
  // });

  // describe('Parse Event Persons', () => {
  //   it('')
  // });

  // describe('Parse Calendars', () => {
  //   it('')
  // });

  // describe('Parse Calendar Data', () => {
  //   it('Parse Single Event', () => {
  //     const { iCALString, etag, caldavUrl } = mockEventData[11];
  //     const result = PARSER.parseCalendarData(iCALString, etag, caldavUrl, '');

  //     console.log(result);
  //   });
  // });

  describe('Parse Recurrence', () => {
    describe('Parse Recurrence (Daily)', () => {
      const fileNames = recurExpandFixturesTable.default.map((data) => data[1].fileName);
      const cases = [];
      for (let i = 0; i < fileNames.length; i += 1) {
        cases.push([
          fileNames[i],
          recurExpandFixturesTable.default[i][0],
          recurExpandFixturesTable.default[i][1]
        ]);
      }

      test.each(cases)('%p', (fileName, input, expectedResult) => {
        const events = PARSER.parseRecurrence(
          input.rp,
          input.events.filter((e) => e.isMaster === true)[0]
        );

        const editedEvents = input.events.filter((e) => e.isMaster === undefined);

        expect(events.length + editedEvents.length).toBe(expectedResult.events.length);
      });

      it('Parse Basic Daily Event', () => {
        // const { iCALString, etag, caldavUrl } = mockEventData[11];
        // const result = PARSER.parseCalendarData(iCALString, etag, caldavUrl, '');
        // console.log(result);
        // console.log(testInput);
        // console.log(testData);
        // console.log(testInput.rp);
        // const events = PARSER.parseRecurrence(
        //   testInput.rp,
        //   testInput.events.filter((e) => e.isMaster === true)[0]
        // );
        // console.log(events.length, events[0].start, events[0].summary, events[1].summary);
        // console.log(
        //   testOutput.events.length,
        //   testOutput.events[0].start,
        //   testOutput.events[0].summary
        // );
        // expect(events.length).toBe(testOutput.events.length);
      });
    });
  });
});
