# models/product_slot.py
from odoo import models, fields, api
import re
from datetime import datetime, timedelta

class ProductSlot(models.Model):
    _inherit = 'product.slot'

    @api.model
    def get_calendar_bookings(self, start_date, end_date, lane_filter='all'):
        """Get bookings for custom calendar view - Admin only"""
        
        domain = [
            ('date', '>=', start_date),
            ('date', '<=', end_date),
            '|',
            ('is_booked', '=', True),
            ('sale_id.invoice_ids', '!=', False)
        ]
        
        if lane_filter and lane_filter != 'all':
            domain.append(('lane_name', '=', lane_filter))
        
        # Remove time_slot from order - we'll sort manually
        bookings = self.search(domain, order='date asc')
        
        # Group consecutive bookings by date, lane, and customer
        grouped_bookings = {}
        
        for booking in bookings:
            # Get user name - prioritize customer from sale order
            if booking.sale_id and booking.sale_id.partner_id:
                user_name = booking.sale_id.partner_id.name
            elif booking.user_id:
                user_name = booking.user_id.name
            else:
                user_name = 'Guest'
            
            # Get product name
            if booking.product_name:
                product_name = booking.product_name.name
            elif booking.product_id:
                product_name = booking.product_id.name
            else:
                product_name = 'No Product'
            
            # Fetch Addons Info
            addons_info = ""
            if booking.sale_id:
                extra_addons = self.env['extra.addons'].search([('sale_id', '=', booking.sale_id.id)])
                # Use set to clear duplicates
                addon_names = list(set([addon.product_addons_id.name for addon in extra_addons if addon.product_addons_id]))
                if addon_names:
                    addons_info = " + " + " + ".join(addon_names)

            # Create a grouping key
            date_str = booking.date.strftime('%Y-%m-%d') if booking.date else ''
            lane_name = booking.lane_name or 'No Lane'
            sale_ref = booking.sale_id.name if booking.sale_id else 'N/A'
            
            group_key = f"{date_str}_{lane_name}_{user_name}_{sale_ref}"
        
            if group_key not in grouped_bookings:
                grouped_bookings[group_key] = {
                    'id': booking.id,
                    'lane_name': lane_name,
                    'product_name': product_name,
                    'user_name': user_name,
                    'date': date_str,
                    'is_paid': booking.is_paid,
                    'is_booked': booking.is_booked,
                    'sale_id': sale_ref,
                    'addons_info': addons_info,
                    'event_type': booking.event_type,
                    'lane_color': self._get_lane_color(lane_name),
                    'booking_ids': [booking.id],
                    'time_slots': [booking.time_slot]
                }
            else:
                grouped_bookings[group_key]['booking_ids'].append(booking.id)
                grouped_bookings[group_key]['time_slots'].append(booking.time_slot)
        
        # Calculate display information with PROPER SORTING
        for key, group in grouped_bookings.items():
            # Sort time slots chronologically
            sorted_slots = self._sort_time_slots(group['time_slots'])
            
            # Get first and last slot
            start = sorted_slots[0]
            end = sorted_slots[-1]
            actual_end = self._add_30_minutes(end)
            
            # Overall time range for calendar display
            group['time_slot'] = f"{start} - {actual_end}"
            group['start_time'] = start
            group['end_time'] = actual_end
            
            # Individual slots with their ranges for popup detail - SORTED
            group['individual_slots'] = []
            for slot_time in sorted_slots:
                slot_end = self._add_30_minutes(slot_time)
                group['individual_slots'].append({
                    'start': slot_time,
                    'end': slot_end,
                    'display': f"{slot_time} - {slot_end}"
                })
        
        result = list(grouped_bookings.values())
        # Sort result by start_time
        def get_start_time(group):
            try:
                return datetime.strptime(group['start_time'], '%I:%M %p')
            except:
                return datetime.min

        result.sort(key=get_start_time)
        return result

    def _sort_time_slots(self, time_slots):
        """Sort time slots chronologically"""
        from datetime import datetime
        
        def time_to_comparable(time_str):
            """Convert time string to comparable datetime object"""
            try:
                return datetime.strptime(time_str, '%I:%M %p')
            except:
                # Fallback: return a default time if parsing fails
                return datetime.strptime('12:00 AM', '%I:%M %p')
        
        # Sort using the conversion function
        return sorted(time_slots, key=time_to_comparable)

    def _add_30_minutes(self, time_str):
        """Add 30 minutes to a time string and return formatted time"""
        from datetime import datetime, timedelta
        try:
            time_obj = datetime.strptime(time_str, '%I:%M %p')
            new_time = time_obj + timedelta(minutes=30)
            return new_time.strftime('%I:%M %p')
        except:
            return time_str

    
    def _get_lane_color(self, lane_name):
        """Assign colors to lanes"""
        if not lane_name:
            return '#D1D5DB'
            
        color_map = {
            'Lane 1': '#93C5FD',  # Blue
            'Lane 2': '#86EFAC',  # Green
            'Lane 3': '#FDE68A',  # Yellow
            'Lane 4': '#C4B5FD',  # Purple
            'Lane 5': '#FCA5A5',  # Red
            'Lane 6': '#A7F3D0',  # Teal
            'Lane 7': '#FBD5B5',  # Orange
            'Lane 8': '#E0BBE4',  # Lavender
            'Lane 9': '#FFB6C1',  # Light Pink
            'Lane 10': '#98D8C8', # Mint
        }
        
        # Try exact match
        if lane_name in color_map:
            return color_map[lane_name]
        
        # Extract lane number
        match = re.search(r'(\d+)', lane_name)
        if match:
            lane_num = int(match.group(1))
            key = f'Lane {lane_num}'
            if key in color_map:
                return color_map[key]
        
        return '#D1D5DB'
    
    @api.model
    def get_available_lanes(self):
        """Get unique lane names for filters"""
        lanes = self.search([
            ('lane_name', '!=', False),
            ('is_booked', '=', True)
        ]).mapped('lane_name')
        
        unique_lanes = list(set(lanes))
        
        # Natural sort
        def natural_sort_key(s):
            return [int(text) if text.isdigit() else text.lower()
                    for text in re.split(r'(\d+)', s)]
        
        return sorted(unique_lanes, key=natural_sort_key)
    
    @api.model
    def get_booking_statistics(self, start_date, end_date):
        """Get booking statistics for admin dashboard"""
        domain = [
            ('date', '>=', start_date),
            ('date', '<=', end_date),
            ('is_booked', '=', True)
        ]
        
        bookings = self.search(domain)
        
        total = len(bookings)
        paid = len(bookings.filtered(lambda b: b.is_paid))
        unpaid = total - paid
        
        # Revenue calculation (if you have price field)
        # total_revenue = sum(bookings.mapped('price'))
        
        # Lane statistics
        lane_stats = {}
        for booking in bookings:
            lane = booking.lane_name or 'Unknown'
            if lane not in lane_stats:
                lane_stats[lane] = {'count': 0, 'paid': 0, 'unpaid': 0}
            lane_stats[lane]['count'] += 1
            if booking.is_paid:
                lane_stats[lane]['paid'] += 1
            else:
                lane_stats[lane]['unpaid'] += 1
        
        return {
            'total_bookings': total,
            'paid_bookings': paid,
            'unpaid_bookings': unpaid,
            'lane_statistics': lane_stats,
        }
