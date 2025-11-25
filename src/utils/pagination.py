from flask import request, jsonify

class Paginator:
    def __init__(self, items=None, page=1, per_page=20, max_per_page=100, total_items=0):
        self.items = items or []
        self.page = max(1, page)
        self.per_page = max(1, min(per_page, max_per_page))
        self.total_items = total_items if total_items > 0 else (len(items) if isinstance(items, list) else 0)
        self.total_pages = (self.total_items + self.per_page - 1) // self.per_page if self.total_items > 0 else 0
        
    @property
    def has_prev(self):
        return self.page > 1
    
    @property
    def has_next(self):
        return self.page < self.total_pages
    
    @property
    def prev_page(self):
        return self.page - 1 if self.has_prev else None
    
    @property
    def next_page(self):
        return self.page + 1 if self.has_next else None
    
    def get_items(self):
        if not isinstance(self.items, list):
            return []
        
        start = (self.page - 1) * self.per_page
        end = start + self.per_page
        return self.items[start:end]
    
    def to_dict(self):
        return {
            'items': self.get_items(),
            'page': self.page,
            'per_page': self.per_page,
            'total_items': self.total_items,
            'total_pages': self.total_pages,
            'has_prev': self.has_prev,
            'has_next': self.has_next,
            'prev_page': self.prev_page,
            'next_page': self.next_page
        }

def paginate_query_params():
    page = max(1, request.args.get('page', 1, type=int))
    per_page = max(1, min(request.args.get('per_page', 20, type=int), 100))
    return page, per_page

def paginated_response(items, page=1, per_page=20):
    paginator = Paginator(items, page, per_page)
    return jsonify({
        'success': True,
        **paginator.to_dict()
    })
