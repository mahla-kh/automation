<?php

namespace App\Services\Support;

use Collator;

class NaturalSorter
{
    /**
     * Sorts an array of items by filename or extracted string using ICU natural/numeric collation.
     */
    public static function sort(array &$items, callable $keyExtractor): void
    {
        if (class_exists(Collator::class)) {
            $collator = new Collator('en_US');
            $collator->setAttribute(Collator::NUMERIC_COLLATION, Collator::ON);

            usort($items, function ($a, $b) use ($collator, $keyExtractor) {
                return $collator->compare($keyExtractor($a), $keyExtractor($b));
            });
        } else {
            usort($items, function ($a, $b) use ($keyExtractor) {
                return strnatcasecmp($keyExtractor($a), $keyExtractor($b));
            });
        }
    }
}
