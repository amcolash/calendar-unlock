import icalendar
import datetime
import pytz
utc = pytz.utc

YEAR = datetime.date.today().year
USER = 'amcolash@salesforce.com'
FILTER = [ 'Lunch', 'Meeting Free Friday', 'Formatting Meeting-Free Friday', 'Project Time', 'Formatting Retrospective', 'Formatting Standup', 'Formatting Sprint Review' ]

def main():
  with open('public/in.ics', 'r', encoding='utf-8') as f:
    cal = icalendar.Calendar.from_ical(f.read())
    outcal = icalendar.Calendar()

    for name, value in cal.items():
      outcal.add(name, value)

    def active_event(item):
      # Check if the event was declined

      # Get attendees for event
      attendees = item.get('ATTENDEE')

      # If there is only one attendee, check it
      if attendees and hasattr(attendees, 'params'):
        if attendees.params['CN'] == USER and attendees.params['PARTSTAT'] == 'DECLINED':
          # print(attendees.params)
          return False
      # If there are multiple, check each individually
      elif attendees and len(attendees) > 0:
        for a in attendees:
          if hasattr(a, 'params'):
            if a.params['CN'] == USER and a.params['PARTSTAT'] == 'DECLINED':
              # print(a.params)
              return False

      # Filter out some events by event name
      for f in FILTER:
        if item['SUMMARY'] == f:
          return False

      start_date = item['dtstart'].dt

      # recurrent
      if 'RRULE' in item:
        rrule = item['RRULE']
        # print (rrule)
        if 'UNTIL' not in rrule:
          return True
        else:
          assert len(rrule['UNTIL']) == 1
          until_date = rrule['UNTIL'][0]

          if type(until_date) == datetime.datetime:
            return until_date >= utc.localize(datetime.datetime(YEAR, 1, 1))

          if type(until_date) == datetime.date:
            return until_date >= datetime.date(YEAR + 1, 1, 1)

          raise Exception('Unknown date format for "UNTIL" field')

      # not reccurrent
      if type(start_date) == datetime.datetime:
        return start_date >= utc.localize(datetime.datetime(YEAR, 1, 1))

      if type(start_date) == datetime.date:
        return start_date >= datetime.date(YEAR + 1, 1, 1)

      raise Exception('ARGH')


    for item in cal.subcomponents:
      if item.name == 'VEVENT':
        start_date = item['dtstart'].dt
        if active_event(item):
          print ('INCLUDE', item['summary'], repr(start_date))
          outcal.add_component(item)
        else:
          print ('EXCLUDE', item['summary'], repr(start_date))
          pass
      else:
        outcal.add_component(item)

    with open('public/out.ics', 'wb') as outf:
      outf.write(outcal.to_ical(sorted=False))

main()
