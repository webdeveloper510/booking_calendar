# {
#     'name': 'US Arena Booking Calendar Dashboard',
#     'version': '1.0',
#     'summary': 'Admin Calendar View for Lane Rental Bookings',
#     'depends': ['calendar', 'sale','sale_management', 'us_arena_website'],
#     'data': [
#         'views/calendar_admin_view.xml'
#     ],
#     'application': True,
#     'installable': True,
# }


{
    'name': 'US Arena Booking Calendar Dashboard',
    'version': '1.0',
    'summary': 'Admin Calendar View for Lane Rental Bookings',
    'depends': [
        'base',
        'web',
        'sale_management',
        'us_arena_website',  # Your website module
    ],
    
   'data': [
        'views/calendar_admin_view.xml',
    ],
    
    'assets': {
        'web.assets_backend': [
            'us_arena_booking_calendar/static/src/js/booking_calendar_widget.js',
            'us_arena_booking_calendar/static/src/css/booking_calendar.css',
            'us_arena_booking_calendar/static/src/xml/booking_calendar_templates.xml',
        ],
    },
    
    'installable': True,
    'application': False,
    'auto_install': False,
}